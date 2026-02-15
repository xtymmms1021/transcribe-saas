import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { transcribeQueue } from '@/lib/queue';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sess = getSession(req);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const a = await db.query(`select id,user_id,status from audio_file where id=$1`, [params.id]);
  if (!a.rowCount || a.rows[0].user_id !== sess.userId) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await db.query(`update audio_file set status='queued' where id=$1`, [params.id]);
  await transcribeQueue.add('transcribe', { audioFileId: params.id, userId: sess.userId });
  return NextResponse.json({ ok: true });
}
