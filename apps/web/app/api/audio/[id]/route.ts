import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const r = await db.query(
    `select id,project_id,original_filename,mime_type,status,error_message,created_at
     from audio_file where id=$1 and user_id=$2`,
    [params.id, s.userId]
  );
  if (!r.rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const t = await db.query(
    `select id,created_at from transcript where audio_file_id=$1 and user_id=$2 order by created_at desc limit 1`,
    [params.id, s.userId]
  );

  return NextResponse.json({ audio: r.rows[0], transcript: t.rows[0] || null });
}
