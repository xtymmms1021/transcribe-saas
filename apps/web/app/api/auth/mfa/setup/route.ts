import { NextRequest, NextResponse } from 'next/server';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const secret = speakeasy.generateSecret({ name: `${process.env.MFA_ISSUER || 'Transcribe'}:${s.email}` });
  await db.query(`update app_user set mfa_secret=$1 where id=$2`, [secret.base32, s.userId]);
  const qr = await QRCode.toDataURL(secret.otpauth_url || '');
  return NextResponse.json({ secret: secret.base32, otpauth: secret.otpauth_url, qrDataUrl: qr });
}
