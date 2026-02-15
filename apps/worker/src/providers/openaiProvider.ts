import OpenAI from 'openai';
import type { TranscribeResult, TranscriptionProvider } from './types.js';

export class OpenAIProvider implements TranscriptionProvider {
  name = 'openai';
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  private model = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';

  async transcribeFromBuffer(buffer: Buffer, filename: string, language = 'ja'): Promise<TranscribeResult> {
    const file = await OpenAI.toFile(buffer, filename);
    const res: any = await this.client.audio.transcriptions.create({
      file,
      model: this.model,
      language
    });

    const segs = Array.isArray(res.segments) && res.segments.length
      ? res.segments.map((s: any) => ({
          startMs: Math.round((s.start ?? 0) * 1000),
          endMs: Math.round((s.end ?? 0) * 1000),
          text: s.text ?? '',
          speakerTempId: 'SPEAKER_00',
          confidence: typeof s.avg_logprob === 'number' ? s.avg_logprob : undefined
        }))
      : [{ startMs: 0, endMs: 0, text: res.text || '', speakerTempId: 'SPEAKER_00' }];

    return {
      language,
      fullText: res.text || segs.map((s: any) => s.text).join(' '),
      segments: segs,
      provider: 'openai',
      model: this.model,
      raw: res
    };
  }
}
