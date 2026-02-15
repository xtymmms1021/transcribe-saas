import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

const AUTO_THRESHOLD = Number(process.env.SPEAKER_AUTO_THRESHOLD || '0.78');
const SUGGEST_THRESHOLD = Number(process.env.SPEAKER_SUGGEST_THRESHOLD || '0.7');

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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sess = getSession(req);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const profiles = await db.query(
    `select id, embedding_centroid::text as c from speaker_profile where user_id=$1 and embedding_count>0 and embedding_centroid is not null and auto_label_enabled=true`,
    [sess.userId]
  );
  const prof = profiles.rows.map((r) => ({ id: r.id as string, c: parseVector(r.c as string) }));
  if (!prof.length) return NextResponse.json({ ok: true, updated: 0, message: 'no profiles with embeddings' });

  const segs = await db.query(
    `select s.id, e.embedding::text as emb from transcript_segment s
     join segment_embedding e on e.segment_id=s.id and e.user_id=s.user_id
     where s.transcript_id=$1 and s.user_id=$2 and s.speaker_profile_id is null`,
    [params.id, sess.userId]
  );

  let updated = 0;
  for (const row of segs.rows) {
    const emb = parseVector(row.emb as string);
    let best: { id: string; score: number } | null = null;
    for (const p of prof) {
      const score = cosine(emb, p.c);
      if (!best || score > best.score) best = { id: p.id, score };
    }
    if (!best) continue;

    const decision = best.score >= AUTO_THRESHOLD ? 'auto' : best.score >= SUGGEST_THRESHOLD ? 'suggested' : 'unknown';
    if (decision === 'auto') {
      await db.query(`update transcript_segment set speaker_profile_id=$1 where id=$2 and user_id=$3`, [best.id, row.id, sess.userId]);
      updated++;
    }
    await db.query(
      `insert into speaker_match(user_id,segment_id,matched_profile_id,score,decision) values($1,$2,$3,$4,$5)`,
      [sess.userId, row.id, decision === 'unknown' ? null : best.id, best.score, decision]
    );
  }

  return NextResponse.json({ ok: true, updated, scanned: segs.rowCount || 0 });
}
