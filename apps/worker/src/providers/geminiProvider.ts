import type { TranscribeResult, TranscriptionProvider } from './types.js';

export class GeminiProvider implements TranscriptionProvider {
  name = 'gemini';
  private model = process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.0-flash';

  async transcribeFromBuffer(buffer: Buffer, filename: string, language = 'ja'): Promise<TranscribeResult> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY missing');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${key}`;
    const base64 = buffer.toString('base64');

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `以下の音声を${language}で文字起こししてください。話者情報がない場合はSPEAKER_00として扱ってください。JSONのみで返答: {"text":"...","segments":[{"startMs":0,"endMs":0,"text":"...","speakerTempId":"SPEAKER_00"}]}` },
            { inlineData: { mimeType: 'audio/mpeg', data: base64 } }
          ]
        }
      ],
      generationConfig: { responseMimeType: 'application/json' }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`gemini error ${res.status}: ${await res.text()}`);
    const json: any = await res.json();
    const textOut = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsed: any = {};
    try { parsed = JSON.parse(textOut); } catch { parsed = { text: textOut, segments: [{ startMs: 0, endMs: 0, text: textOut, speakerTempId: 'SPEAKER_00' }] }; }

    const segments = Array.isArray(parsed.segments) ? parsed.segments.map((s: any) => ({
      startMs: Number(s.startMs || 0),
      endMs: Number(s.endMs || 0),
      text: String(s.text || ''),
      speakerTempId: String(s.speakerTempId || 'SPEAKER_00')
    })) : [{ startMs: 0, endMs: 0, text: String(parsed.text || ''), speakerTempId: 'SPEAKER_00' }];

    return {
      language,
      fullText: String(parsed.text || segments.map((s: any) => s.text).join(' ')),
      segments,
      provider: 'gemini',
      model: this.model,
      raw: json
    };
  }
}
