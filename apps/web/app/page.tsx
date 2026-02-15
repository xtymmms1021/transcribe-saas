'use client';

import { useState } from 'react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [projectId, setProjectId] = useState('');
  const [audioFileId, setAudioFileId] = useState('');
  const [uploadUrl, setUploadUrl] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const push = (m: string) => setLog((l) => [m, ...l]);

  async function register() {
    const r = await fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
    const j = await r.json();
    if (j.defaultProject?.id) setProjectId(j.defaultProject.id);
    push(JSON.stringify(j));
  }

  async function login() {
    const r = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    push(JSON.stringify(await r.json()));
  }

  async function getUploadUrl(file: File) {
    const r = await fetch('/api/audio/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, mimeType: file.type, projectId })
    });
    const j = await r.json();
    setAudioFileId(j.audioFileId);
    setUploadUrl(j.uploadUrl);
    push(JSON.stringify(j));
    return j;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const j = await getUploadUrl(f);
    await fetch(j.uploadUrl, { method: 'PUT', body: f, headers: { 'Content-Type': f.type || 'audio/mpeg' } });
    push('uploaded to object storage');
  }

  async function enqueue() {
    const r = await fetch(`/api/audio/enqueue/${audioFileId}`, { method: 'POST' });
    push(JSON.stringify(await r.json()));
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 900 }}>
      <h1>Transcribe SaaS</h1>
      <p>OpenAI先行 / Gemini拡張対応・MFA対応・ユーザー分離</p>
      <div style={{ display: 'grid', gap: 8 }}>
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={register}>Register</button>
        <button onClick={login}>Login</button>
        <input placeholder="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
        <input type="file" accept="audio/*" onChange={onFile} />
        <div>audioFileId: {audioFileId}</div>
        <button onClick={enqueue} disabled={!audioFileId}>Enqueue Transcription</button>
      </div>

      <h3>Logs</h3>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#111', color: '#0f0', padding: 12, minHeight: 200 }}>
        {log.join('\n')}
      </pre>
    </main>
  );
}
