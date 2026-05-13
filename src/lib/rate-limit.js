import db from '@/lib/db';

// Failed logins per identifier (email or IP) allowed within WINDOW_MS before
// a temporary lockout kicks in.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

function nowMinusWindow() {
  return new Date(Date.now() - WINDOW_MS).toISOString().slice(0, 19).replace('T', ' ');
}

// Pulls a best-effort client IP from common proxy headers, falling back to
// the literal string 'unknown' so the throttle still works when headers are
// stripped. Cloud Run sets X-Forwarded-For.
export function clientIp(request) {
  const h = request.headers;
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return h.get('x-real-ip') || 'unknown';
}

// Returns { blocked: boolean, retryAfterSec?: number }. Caller should reject
// with 429 when blocked.
export async function checkLoginThrottle(identifiers) {
  const cutoff = nowMinusWindow();
  for (const id of identifiers) {
    if (!id) continue;
    const row = await db.prepare(
      `SELECT COUNT(*) AS fails, MAX(attempted_at) AS latest
         FROM login_attempts
        WHERE identifier = ? AND success = 0 AND attempted_at >= ?`
    ).get(id, cutoff);
    if (row && row.fails >= MAX_FAILS) {
      const latestMs = new Date(row.latest).getTime();
      const retry = Math.max(1, Math.ceil((latestMs + WINDOW_MS - Date.now()) / 1000));
      return { blocked: true, retryAfterSec: retry };
    }
  }
  return { blocked: false };
}

export async function recordLoginAttempt(identifier, success) {
  if (!identifier) return;
  await db.prepare(
    `INSERT INTO login_attempts (identifier, success) VALUES (?, ?)`
  ).run(identifier, success ? 1 : 0);
}

// On successful login, wipe the failure counter so a legitimate user isn't
// kept locked out by their own earlier typos.
export async function clearLoginFailures(identifiers) {
  for (const id of identifiers) {
    if (!id) continue;
    await db.prepare(
      `DELETE FROM login_attempts WHERE identifier = ? AND success = 0`
    ).run(id);
  }
}
