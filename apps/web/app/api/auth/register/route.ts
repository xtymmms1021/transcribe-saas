import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  const { email, password, name } = await req.json();
  if (!email || !password) return NextResponse.json({ error: 'email/password required' }, { status: 400 });
  const hash = await bcrypt.hash(password, 10);
  const user = await db.query(
    `insert into app_user(email, password_hash, name) values($1,$2,$3) returning id,email`,
    [email, hash, name || null]
  ).catch(() => null);
  if (!user) return NextResponse.json({ error: 'email already exists' }, { status: 409 });

  const pid = await db.query(`insert into project(user_id,name) values($1,$2) returning id,name`, [user.rows[0].id, 'Default']);
  return NextResponse.json({ ok: true, user: user.rows[0], defaultProject: pid.rows[0] });
}
