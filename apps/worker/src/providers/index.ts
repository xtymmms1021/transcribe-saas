import type { TranscriptionProvider } from "./types.js";
import { OpenAIProvider } from "./openaiProvider.js";
import { GeminiProvider } from "./geminiProvider.js";

export function createProvider(): TranscriptionProvider {
  const provider = (process.env.TRANSCRIPTION_PROVIDER || "openai").toLowerCase();
  if (provider === "openai") return new OpenAIProvider();
  if (provider === "gemini") return new GeminiProvider();
  throw new Error(`Unknown provider: ${provider}`);
}
