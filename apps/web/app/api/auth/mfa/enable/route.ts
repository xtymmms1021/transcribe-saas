import { NextRequest, NextResponse } from 'next/server';
import speakeasy from 'speakeasy';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { code } = await req.json();
  const u = await db.query(`select mfa_secret from app_user where id=$1`, [s.userId]);
  const sec = u.rows[0]?.mfa_secret;
  if (!sec) return NextResponse.json({ error: 'setup first' }, { status: 400 });
  const ok = speakeasy.totp.verify({ secret: sec, encoding: 'base32', token: code });
  if (!ok) return NextResponse.json({ error: 'invalid code' }, { status: 400 });
  await db.query(`update app_user set mfa_enabled=true where id=$1`, [s.userId]);
  return NextResponse.json({ ok: true });
}
