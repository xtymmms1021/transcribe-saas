import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { db } from '@/lib/db';
import { signSession } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password, mfaCode } = await req.json();
  const u = await db.query(`select id,email,password_hash,mfa_enabled,mfa_secret from app_user where email=$1`, [email]);
  if (!u.rowCount) return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  const user = u.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });

  if (user.mfa_enabled) {
    if (!mfaCode) return NextResponse.json({ error: 'mfa_required' }, { status: 401 });
    const verified = speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token: mfaCode });
    if (!verified) return NextResponse.json({ error: 'invalid mfa code' }, { status: 401 });
  }

  const token = signSession({ userId: user.id, email: user.email, mfaPassed: true });
  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', token, { httpOnly: true, sameSite: 'lax', path: '/', secure: false });
  return res;
}
