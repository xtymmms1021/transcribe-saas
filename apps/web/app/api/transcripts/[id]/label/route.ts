import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

function parseVector(input: string | null): number[] {
  if (!input) return [];
  const s = input.trim();
  if (!s.startsWith('[') || !s.endsWith(']')) return [];
  return s.slice(1, -1).split(',').map(Number).filter((n) => Number.isFinite(n));
}

function vecAvg(vectors: number[][]): number[] {
  if (!vectors.length) return [];
  const d = vectors[0].length;
  const out = new Array(d).fill(0);
  for (const v of vectors) for (let i = 0; i < d; i++) out[i] += v[i] || 0;
  for (let i = 0; i < d; i++) out[i] /= vectors.length;
  return out;
}

function vecWeighted(oldVec: number[], oldN: number, newVec: number[], newN: number): number[] {
  if (!oldVec.length) return newVec;
  const d = oldVec.length;
  const out = new Array(d).fill(0);
  for (let i = 0; i < d; i++) {
    out[i] = ((oldVec[i] || 0) * oldN + (newVec[i] || 0) * newN) / (oldN + newN);
  }
  return out;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sess = getSession(req);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { segmentIds, displayName } = await req.json();
  if (!Array.isArray(segmentIds) || !displayName) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });

  let profile = await db.query(`select id,embedding_count,embedding_centroid::text as embedding_centroid from speaker_profile where user_id=$1 and display_name=$2`, [sess.userId, displayName]);
  if (!profile.rowCount) {
    profile = await db.query(
      `insert into speaker_profile(user_id,display_name,embedding_count) values($1,$2,0) returning id,embedding_count,embedding_centroid::text as embedding_centroid`,
      [sess.userId, displayName]
    );
  }
  const p = profile.rows[0];
  const pid = p.id;

  await db.query(
    `update transcript_segment set speaker_profile_id=$1
     where transcript_id=$2 and user_id=$3 and id = any($4::uuid[])`,
    [pid, params.id, sess.userId, segmentIds]
  );

  const embRows = await db.query(
    `select embedding::text as embedding from segment_embedding where user_id=$1 and segment_id = any($2::uuid[])`,
    [sess.userId, segmentIds]
  );

  const vectors = embRows.rows.map((r) => parseVector(r.embedding)).filter((v) => v.length === 192);
  if (vectors.length) {
    const newMean = vecAvg(vectors);
    const oldVec = parseVector(p.embedding_centroid);
    const oldN = Number(p.embedding_count || 0);
    const merged = vecWeighted(oldVec, oldN, newMean, vectors.length);
    await db.query(
      `update speaker_profile set embedding_centroid=$1::vector, embedding_count=$2 where id=$3 and user_id=$4`,
      [`[${merged.join(',')}]`, oldN + vectors.length, pid, sess.userId]
    );
  }

  await db.query(
    `insert into speaker_match(user_id,segment_id,matched_profile_id,score,decision)
     select $1, id, $2, 1.0, 'user_confirmed'::text from transcript_segment
     where transcript_id=$3 and user_id=$1 and id = any($4::uuid[])`,
    [sess.userId, pid, params.id, segmentIds]
  );

  return NextResponse.json({ ok: true, speakerProfileId: pid, embeddingsLearned: vectors.length });
}
