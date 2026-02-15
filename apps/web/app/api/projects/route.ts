import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const r = await db.query(`select id,name,created_at from project where user_id=$1 order by created_at desc`, [s.userId]);
  return NextResponse.json({ projects: r.rows });
}

export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { name } = await req.json();
  const r = await db.query(`insert into project(user_id,name) values($1,$2) returning id,name,created_at`, [s.userId, name]);
  return NextResponse.json({ project: r.rows[0] });
}
