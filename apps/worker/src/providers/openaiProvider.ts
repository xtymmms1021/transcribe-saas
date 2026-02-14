import fs from "node:fs";
import OpenAI from "openai";
import type { TranscribeInput, TranscribeResult, TranscriptionProvider } from "./types.js";

export class OpenAIProvider implements TranscriptionProvider {
  name = "openai";
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  private model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const file = fs.createReadStream(input.audioPath);
    const res: any = await this.client.audio.transcriptions.create({
      file,
      model: this.model,
      language: input.language || "ja"
    });

    return {
      language: input.language || "ja",
      fullText: res.text ?? "",
      segments: (res.segments || []).map((s: any) => ({
        startMs: Math.round((s.start ?? 0) * 1000),
        endMs: Math.round((s.end ?? 0) * 1000),
        text: s.text ?? "",
        confidence: typeof s.avg_logprob === "number" ? s.avg_logprob : undefined
      })),
      provider: this.name,
      model: this.model,
      raw: res
    };
  }

  async health() {
    return { ok: Boolean(process.env.OPENAI_API_KEY), message: "OPENAI_API_KEY" };
  }
}
