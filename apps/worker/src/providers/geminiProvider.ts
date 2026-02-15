import type { TranscribeResult, TranscriptionProvider } from './types.js';

export class GeminiProvider implements TranscriptionProvider {
  name = 'gemini';
  async transcribeFromBuffer(_buffer: Buffer, _filename: string, _language = 'ja'): Promise<TranscribeResult> {
    throw new Error('Gemini provider not implemented yet');
  }
}
