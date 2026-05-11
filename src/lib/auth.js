import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-me'
);
const SESSION_COOKIE = 'temple_session';

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

// Build a session payload for a member row. Carries is_admin + permissions
// so middleware can authorize without an extra DB hit on every request.
export function buildSessionPayload(member) {
  const perms = parsePermissions(member.admin_permissions);
  return {
    sub: member.id,
    name: member.name,
    email: member.email,
    is_admin: member.is_admin ? 1 : 0,
    permissions: perms,
  };
}

export function parsePermissions(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasPermission(session, perm) {
  if (!session?.is_admin) return false;
  const perms = session.permissions || [];
  return perms.includes('*') || perms.includes(perm);
}

// Use this in Route Handlers — attaches the unified session cookie.
export async function createSessionResponse(payload, responseBody) {
  const token = await signToken(payload);
  const res = NextResponse.json(responseBody);
  res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTIONS);
  return res;
}

export function createLogoutResponse() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  return res;
}

export async function getSession() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Like getSession() but also confirms the underlying member is still active
// (not is_disabled). Use this in server-rendered layouts so a stale cookie for
// a since-suspended account doesn't bypass the gate. Returns null if the
// session is missing, invalid, or the member is disabled / deleted.
export async function getActiveSession() {
  const session = await getSession();
  if (!session) return null;
  // Dynamic import keeps this server-only and avoids pulling mysql2 into edge bundles.
  const { default: db } = await import('./db');
  const m = await db.prepare('SELECT id, is_disabled FROM members WHERE id = ?').get(session.sub);
  if (!m || m.is_disabled) return null;
  return session;
}
