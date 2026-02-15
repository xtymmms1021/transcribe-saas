import { OpenAIProvider } from './openaiProvider.js';
import { GeminiProvider } from './geminiProvider.js';

export function getProvider() {
  const p = (process.env.TRANSCRIPTION_PROVIDER || 'openai').toLowerCase();
  if (p === 'openai') return new OpenAIProvider();
  if (p === 'gemini') return new GeminiProvider();
  throw new Error(`unknown provider: ${p}`);
}
