import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const sess = getSession(req);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const r = await db.query(`select id,display_name,embedding_count,auto_label_enabled,created_at from speaker_profile where user_id=$1 order by created_at desc`, [sess.userId]);
  return NextResponse.json({ speakers: r.rows });
}
