export type DiarizationSegment = {
  startMs: number;
  endMs: number;
  speakerId: string;
  embedding?: number[];
};

function overlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

export async function runExternalDiarization(audioBuffer: Buffer, filename: string): Promise<DiarizationSegment[] | null> {
  const endpoint = process.env.DIARIZATION_EXTERNAL_ENDPOINT;
  if (!endpoint) return null;

  const token = process.env.DIARIZATION_EXTERNAL_TOKEN;
  const payload = {
    filename,
    mimeType: 'audio/mpeg',
    audioBase64: audioBuffer.toString('base64')
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`external diarization failed: ${res.status} ${await res.text()}`);
  }

  const json: any = await res.json();
  const segs = Array.isArray(json?.segments) ? json.segments : [];

  return segs.map((s: any) => ({
    startMs: Number(s.startMs || 0),
    endMs: Number(s.endMs || 0),
    speakerId: String(s.speakerId || 'SPEAKER_00'),
    embedding: Array.isArray(s.embedding) ? s.embedding.map(Number) : undefined
  }));
}

export function applyDiarizationToAsr<T extends { startMs: number; endMs: number; speakerTempId: string; speakerEmbedding?: number[] }>(
  asrSegments: T[],
  diarSegments: DiarizationSegment[] | null
): T[] {
  if (!diarSegments || diarSegments.length === 0) return asrSegments;

  return asrSegments.map((a) => {
    let best: DiarizationSegment | null = null;
    let bestOv = 0;
    for (const d of diarSegments) {
      const ov = overlap(a.startMs, a.endMs, d.startMs, d.endMs);
      if (ov > bestOv) {
        bestOv = ov;
        best = d;
      }
    }
    if (!best) return a;
    return {
      ...a,
      speakerTempId: best.speakerId || a.speakerTempId,
      speakerEmbedding: best.embedding && best.embedding.length ? best.embedding : a.speakerEmbedding
    };
  });
}
