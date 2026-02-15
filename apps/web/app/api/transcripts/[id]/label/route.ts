import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sess = getSession(req);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { segmentIds, displayName } = await req.json();
  if (!Array.isArray(segmentIds) || !displayName) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });

  let profile = await db.query(`select id from speaker_profile where user_id=$1 and display_name=$2`, [sess.userId, displayName]);
  if (!profile.rowCount) {
    profile = await db.query(`insert into speaker_profile(user_id,display_name) values($1,$2) returning id`, [sess.userId, displayName]);
  }
  const pid = profile.rows[0].id;

  await db.query(
    `update transcript_segment set speaker_profile_id=$1
     where transcript_id=$2 and user_id=$3 and id = any($4::uuid[])`,
    [pid, params.id, sess.userId, segmentIds]
  );

  return NextResponse.json({ ok: true, speakerProfileId: pid });
}
