import bcrypt from 'bcryptjs';
import db from '@/lib/db';

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;

export function generateCode() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

export async function issueCode(email) {
  const recent = await db.prepare(`
    SELECT created_at FROM email_verifications
    WHERE email = ? AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(email);
  if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(recent.created_at).getTime())) / 1000);
    const err = new Error(`請稍候 ${wait} 秒後再試`);
    err.code = 'RATE_LIMIT';
    throw err;
  }

  await db.prepare(`
    UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP
    WHERE email = ? AND used_at IS NULL
  `).run(email);

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const expiresStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

  await db.prepare(`
    INSERT INTO email_verifications (email, code_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(email, codeHash, expiresStr);

  return code;
}

export async function verifyAndConsume(email, code) {
  const row = await db.prepare(`
    SELECT id, code_hash, expires_at, attempts FROM email_verifications
    WHERE email = ? AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(email);
  if (!row) return { ok: false, reason: 'NO_CODE' };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.prepare(`UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).run(row.id);
    return { ok: false, reason: 'EXPIRED' };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.prepare(`UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).run(row.id);
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
  }

  const match = await bcrypt.compare(code, row.code_hash);
  if (!match) {
    await db.prepare(`UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    return { ok: false, reason: 'INVALID', attemptsLeft: MAX_ATTEMPTS - row.attempts - 1 };
  }

  await db.prepare(`UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).run(row.id);
  return { ok: true };
}
