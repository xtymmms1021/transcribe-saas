import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.AUTH_SECRET || 'dev-secret';

export type SessionUser = { userId: string; email: string; mfaPassed: boolean };

export function signSession(payload: SessionUser) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifySession(token?: string): SessionUser | null {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
  } catch {
    return null;
  }
}

export function getSession(req: NextRequest): SessionUser | null {
  const token = req.cookies.get('session')?.value;
  return verifySession(token);
}
