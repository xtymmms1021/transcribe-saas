import { createProvider } from "../providers/index.js";

export async function runTranscribeJob(audioPath: string) {
  const provider = createProvider();
  const result = await provider.transcribe({ audioPath, language: "ja" });
  return result;
}
