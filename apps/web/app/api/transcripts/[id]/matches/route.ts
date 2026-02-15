import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const r = await db.query(
    `select sm.segment_id, sm.score, sm.decision, sm.created_at, sp.display_name
     from speaker_match sm
     join transcript_segment ts on ts.id = sm.segment_id and ts.user_id = sm.user_id
     left join speaker_profile sp on sp.id = sm.matched_profile_id
     where ts.transcript_id=$1 and sm.user_id=$2
     order by sm.created_at desc`,
    [params.id, s.userId]
  );

  return NextResponse.json({ matches: r.rows });
}
