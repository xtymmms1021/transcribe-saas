import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

function msToSrtTime(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRest = ms % 1000;
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(msRest, 3)}`;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const format = (req.nextUrl.searchParams.get('format') || 'json').toLowerCase();

  const t = await db.query(`select id,full_text,language,created_at from transcript where id=$1 and user_id=$2`, [params.id, s.userId]);
  if (!t.rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const seg = await db.query(
    `select s.id,s.start_ms,s.end_ms,s.text,s.speaker_temp_id,sp.display_name
     from transcript_segment s
     left join speaker_profile sp on sp.id=s.speaker_profile_id
     where s.transcript_id=$1 and s.user_id=$2
     order by s.start_ms asc`,
    [params.id, s.userId]
  );

  if (format === 'txt') {
    const text = seg.rows.map((r) => `[${r.display_name || r.speaker_temp_id}] ${r.text}`).join('\n');
    return new NextResponse(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  if (format === 'srt') {
    const srt = seg.rows
      .map((r, i) => `${i + 1}\n${msToSrtTime(r.start_ms)} --> ${msToSrtTime(r.end_ms)}\n[${r.display_name || r.speaker_temp_id}] ${r.text}\n`)
      .join('\n');
    return new NextResponse(srt, { headers: { 'content-type': 'application/x-subrip; charset=utf-8' } });
  }

  return NextResponse.json({ transcript: t.rows[0], segments: seg.rows });
}
