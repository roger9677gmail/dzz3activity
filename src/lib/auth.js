import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-me'
);
const MEMBER_COOKIE = 'temple_session';
const ADMIN_COOKIE = 'temple_admin_session';

export async function signToken(payload, expiresIn = '7d') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
};

// Use this in Route Handlers — attaches cookie to a NextResponse
export async function createSessionResponse(payload, responseBody, isAdmin = false) {
  const token = await signToken(payload);
  const res = NextResponse.json(responseBody);
  res.cookies.set(isAdmin ? ADMIN_COOKIE : MEMBER_COOKIE, token, COOKIE_OPTIONS);
  return res;
}

// Use this in Route Handlers to clear session
export function createLogoutResponse(isAdmin = false) {
  const res = NextResponse.json({ success: true });
  res.cookies.set(isAdmin ? ADMIN_COOKIE : MEMBER_COOKIE, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
  return res;
}

export async function getSession(isAdmin = false) {
  const cookieStore = cookies();
  const token = cookieStore.get(isAdmin ? ADMIN_COOKIE : MEMBER_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
