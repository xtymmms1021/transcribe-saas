import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { s3 } from '@/lib/s3';

export async function POST(req: NextRequest) {
  const sess = getSession(req);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { filename, mimeType, projectId } = await req.json();

  const p = await db.query(`select id from project where id=$1 and user_id=$2`, [projectId, sess.userId]);
  if (!p.rowCount) return NextResponse.json({ error: 'invalid project' }, { status: 400 });

  const key = `${sess.userId}/${projectId}/${Date.now()}-${filename}`;
  const audio = await db.query(
    `insert into audio_file(user_id,project_id,storage_key,original_filename,mime_type,status) values($1,$2,$3,$4,$5,'uploaded') returning id`,
    [sess.userId, projectId, key, filename, mimeType || null]
  );

  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_AUDIO,
    Key: key,
    ContentType: mimeType || 'audio/mpeg'
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });

  return NextResponse.json({ uploadUrl: url, audioFileId: audio.rows[0].id, key });
}
