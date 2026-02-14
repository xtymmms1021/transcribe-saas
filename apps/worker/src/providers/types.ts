export type Segment = {
  startMs: number;
  endMs: number;
  text: string;
  speakerTempId?: string;
  confidence?: number;
};

export type TranscribeInput = {
  audioPath: string;
  language?: string;
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
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
  health(): Promise<{ ok: boolean; message?: string }>;
}
