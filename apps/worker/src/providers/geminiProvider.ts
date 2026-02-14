import type { TranscribeInput, TranscribeResult, TranscriptionProvider } from "./types.js";

export class GeminiProvider implements TranscriptionProvider {
  name = "gemini";

  async transcribe(_input: TranscribeInput): Promise<TranscribeResult> {
    throw new Error("Gemini provider not implemented yet");
  }

  async health() {
    return { ok: Boolean(process.env.GEMINI_API_KEY), message: "GEMINI_API_KEY" };
  }
}
