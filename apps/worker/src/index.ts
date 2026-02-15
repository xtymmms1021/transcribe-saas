import 'dotenv/config';
import { Worker } from 'bullmq';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { db } from './lib/db.js';
import { redis } from './lib/redis.js';
import { s3 } from './lib/s3.js';
import { getProvider } from './providers/index.js';
import { applyDiarizationToAsr, runExternalDiarization } from './lib/diarization.js';
import { runGoogleSttDiarization } from './lib/googleDiarization.js';

type Profile = { id: string; embedding_centroid: string; embedding_count: number };

const AUTO_THRESHOLD = Number(process.env.SPEAKER_AUTO_THRESHOLD || '0.78');
const SUGGEST_THRESHOLD = Number(process.env.SPEAKER_SUGGEST_THRESHOLD || '0.7');

function toVectorLiteral(v: number[]) {
  return `[${v.join(',')}]`;
}

function parseVector(input: string): number[] {
  const s = input.trim();
  if (!s.startsWith('[') || !s.endsWith(']')) return [];
  return s.slice(1, -1).split(',').map(Number).filter((n) => Number.isFinite(n));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (!na || !nb) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function autoMatchProfile(userId: string, emb?: number[]) {
  if (!emb || emb.length !== 192) return { profileId: null as string | null, score: 0, decision: 'unknown' as const };

  const r = await db.query<Profile>(
    `select id,embedding_centroid::text as embedding_centroid,embedding_count
     from speaker_profile
     where user_id=$1 and embedding_count > 0 and embedding_centroid is not null and auto_label_enabled=true`,
    [userId]
  );

  let best: { id: string; score: number } | null = null;
  for (const p of r.rows) {
    const score = cosine(emb, parseVector(p.embedding_centroid));
    if (!best || score > best.score) best = { id: p.id, score };
  }

  if (!best) return { profileId: null, score: 0, decision: 'unknown' as const };
  if (best.score >= AUTO_THRESHOLD) return { profileId: best.id, score: best.score, decision: 'auto' as const };
  if (best.score >= SUGGEST_THRESHOLD) return { profileId: best.id, score: best.score, decision: 'suggested' as const };
  return { profileId: null, score: best.score, decision: 'unknown' as const };
}

const provider = getProvider();

new Worker(
  'transcribe',
  async (job) => {
    const { audioFileId, userId } = job.data as { audioFileId: string; userId: string };

    const a = await db.query(
      `select id,user_id,storage_key,original_filename from audio_file where id=$1 and user_id=$2`,
      [audioFileId, userId]
    );
    if (!a.rowCount) throw new Error('audio not found');

    await db.query(`update audio_file set status='processing', error_message=null where id=$1`, [audioFileId]);

    try {
      const row = a.rows[0];
      const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET_AUDIO, Key: row.storage_key }));
      const body = await streamToBuffer(obj.Body);
      const result = await provider.transcribeFromBuffer(body, row.original_filename, 'ja');
      const diarizationProvider = (process.env.DIARIZATION_PROVIDER || 'none').toLowerCase();
      let diarizedSegments = result.segments;
      if (diarizationProvider === 'external') {
        const diarSegs = await runExternalDiarization(body, row.original_filename);
        diarizedSegments = applyDiarizationToAsr(result.segments, diarSegs);
      } else if (diarizationProvider === 'google') {
        const diarSegs = await runGoogleSttDiarization(body);
        diarizedSegments = applyDiarizationToAsr(result.segments, diarSegs);
      }

      const t = await db.query(
        `insert into transcript(user_id,audio_file_id,language,full_text,provider,provider_model,raw_provider_payload)
         values($1,$2,$3,$4,$5,$6,$7) returning id`,
        [userId, audioFileId, result.language, result.fullText, result.provider, result.model, result.raw || {}]
      );

      for (const s of diarizedSegments) {
        const match = await autoMatchProfile(userId, s.speakerEmbedding);
        const ins = await db.query(
          `insert into transcript_segment(transcript_id,user_id,start_ms,end_ms,speaker_temp_id,text,confidence,speaker_profile_id)
           values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [t.rows[0].id, userId, s.startMs, s.endMs, s.speakerTempId, s.text, s.confidence || null, match.profileId]
        );
        const segmentId = ins.rows[0].id as string;

        if (s.speakerEmbedding && s.speakerEmbedding.length === 192) {
          await db.query(
            `insert into segment_embedding(segment_id,user_id,embedding) values($1,$2,$3::vector) on conflict (segment_id) do nothing`,
            [segmentId, userId, toVectorLiteral(s.speakerEmbedding)]
          );
        }

        await db.query(
          `insert into speaker_match(user_id,segment_id,matched_profile_id,score,decision) values($1,$2,$3,$4,$5)`,
          [userId, segmentId, match.profileId, match.score, match.decision]
        );
      }

      await db.query(`update audio_file set status='done' where id=$1`, [audioFileId]);
    } catch (e: any) {
      await db.query(`update audio_file set status='failed', error_message=$2 where id=$1`, [audioFileId, e.message || 'failed']);
      throw e;
    }
  },
  { connection: redis }
);

console.log(`[worker] started with provider=${provider.name}`);
