import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import db from './db';

const SESSION_COOKIE = 'temple_session';

// Resolve the signing key lazily so `next build` (which imports route modules
// without a runtime env) doesn't crash. The first call at runtime will throw
// if JWT_SECRET isn't configured — that's a clear, immediate failure rather
// than silently signing tokens with a guessable fallback.
let _secret;
function getSecret() {
  if (_secret) return _secret;
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  _secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return _secret;
}

export async function signToken(payload, expiresIn = '7d') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
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

// Server components don't pass through the API middleware, so the JWT snapshot
// they see for name / is_admin / permissions can be stale (e.g. user renamed
// themselves, or an admin re-assigned permissions). Use this in server pages /
// layouts so the rendered UI always reflects the authoritative DB state.
// Returns null if the cookie is invalid, the account no longer exists, or it
// has been disabled — caller should redirect to /login in that case.
export async function getActiveSession() {
  const session = await getSession();
  if (!session) return null;
  const member = await db
    .prepare('SELECT id, name, is_admin, admin_permissions, is_disabled FROM members WHERE id = ?')
    .get(session.sub);
  if (!member || member.is_disabled) return null;
  return {
    ...session,
    name: member.name,
    is_admin: member.is_admin ? 1 : 0,
    permissions: parsePermissions(member.admin_permissions),
  };
}
