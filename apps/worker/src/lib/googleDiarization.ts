import { SpeechClient } from '@google-cloud/speech';
import type { DiarizationSegment } from './diarization.js';

function to192(seed: string): number[] {
  // deterministic pseudo-embedding fallback from speaker tag
  const out = new Array(192).fill(0);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = 0; i < 192; i++) {
    h ^= i + 1;
    h = Math.imul(h, 16777619);
    out[i] = ((h >>> 0) % 2000) / 1000 - 1;
  }
  return out;
}

export async function runGoogleSttDiarization(audioBuffer: Buffer): Promise<DiarizationSegment[] | null> {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) return null;

  const client = new SpeechClient();

  const [operation] = await client.longRunningRecognize({
    config: {
      encoding: (process.env.GOOGLE_STT_ENCODING as any) || 'MP3',
      sampleRateHertz: Number(process.env.GOOGLE_STT_SAMPLE_RATE || '16000'),
      languageCode: process.env.GOOGLE_STT_LANGUAGE || 'ja-JP',
      enableSpeakerDiarization: true,
      diarizationSpeakerCount: Number(process.env.GOOGLE_STT_SPEAKER_COUNT || '2'),
      model: process.env.GOOGLE_STT_MODEL || 'latest_long',
      enableAutomaticPunctuation: true
    },
    audio: {
      content: audioBuffer.toString('base64')
    }
  });

  const [result] = await operation.promise();
  const words = result.results?.[result.results.length - 1]?.alternatives?.[0]?.words || [];
  if (!words.length) return [];

  const segments: DiarizationSegment[] = [];
  let currentSpeaker = String(words[0].speakerTag || 0);
  let start = Number(words[0].startTime?.seconds || 0) * 1000 + Math.floor(Number(words[0].startTime?.nanos || 0) / 1e6);
  let end = Number(words[0].endTime?.seconds || 0) * 1000 + Math.floor(Number(words[0].endTime?.nanos || 0) / 1e6);

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const sp = String(w.speakerTag || 0);
    const ws = Number(w.startTime?.seconds || 0) * 1000 + Math.floor(Number(w.startTime?.nanos || 0) / 1e6);
    const we = Number(w.endTime?.seconds || 0) * 1000 + Math.floor(Number(w.endTime?.nanos || 0) / 1e6);

    if (sp !== currentSpeaker) {
      segments.push({
        startMs: start,
        endMs: end,
        speakerId: `SPEAKER_${currentSpeaker.padStart(2, '0')}`,
        embedding: to192(currentSpeaker)
      });
      currentSpeaker = sp;
      start = ws;
      end = we;
    } else {
      end = we;
    }
  }

  segments.push({
    startMs: start,
    endMs: end,
    speakerId: `SPEAKER_${currentSpeaker.padStart(2, '0')}`,
    embedding: to192(currentSpeaker)
  });

  return segments;
}
