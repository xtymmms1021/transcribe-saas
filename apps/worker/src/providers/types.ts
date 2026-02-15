export type Segment = {
  startMs: number;
  endMs: number;
  text: string;
  speakerTempId: string;
  confidence?: number;
  speakerEmbedding?: number[];
};

export type TranscribeResult = {
  language: string;
  fullText: string;
  segments: Segment[];
  provider: string;
  model: string;
  raw?: unknown;
};

export interface TranscriptionProvider {
  name: string;
  transcribeFromBuffer(buffer: Buffer, filename: string, language?: string): Promise<TranscribeResult>;
}
