import 'dotenv/config';
import { Worker } from 'bullmq';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { db } from './lib/db.js';
import { redis } from './lib/redis.js';
import { s3 } from './lib/s3.js';
import { getProvider } from './providers/index.js';

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
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

      const t = await db.query(
        `insert into transcript(user_id,audio_file_id,language,full_text,provider,provider_model,raw_provider_payload)
         values($1,$2,$3,$4,$5,$6,$7) returning id`,
        [userId, audioFileId, result.language, result.fullText, result.provider, result.model, result.raw || {}]
      );

      for (const s of result.segments) {
        await db.query(
          `insert into transcript_segment(transcript_id,user_id,start_ms,end_ms,speaker_temp_id,text,confidence)
           values($1,$2,$3,$4,$5,$6,$7)`,
          [t.rows[0].id, userId, s.startMs, s.endMs, s.speakerTempId, s.text, s.confidence || null]
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
