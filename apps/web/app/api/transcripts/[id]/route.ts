import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sess = getSession(req);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const t = await db.query(`select * from transcript where id=$1 and user_id=$2`, [params.id, sess.userId]);
  if (!t.rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const seg = await db.query(
    `select s.*, sp.display_name from transcript_segment s
     left join speaker_profile sp on sp.id=s.speaker_profile_id
     where s.transcript_id=$1 and s.user_id=$2 order by start_ms asc`,
    [params.id, sess.userId]
  );

  return NextResponse.json({ transcript: t.rows[0], segments: seg.rows });
}
