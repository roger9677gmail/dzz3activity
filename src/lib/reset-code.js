import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;

export function generateCode() {
  // 6-digit numeric, zero-padded. randomInt uses a CSPRNG; Math.random is
  // predictable and must not be used for security-relevant tokens.
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function issueCode(memberId) {
  // Throttle: refuse if a code was issued within the cooldown window.
  const recent = await db.prepare(`
    SELECT created_at FROM password_reset_codes
    WHERE member_id = ? AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(memberId);
  if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(recent.created_at).getTime())) / 1000);
    const err = new Error(`請稍候 ${wait} 秒後再試`);
    err.code = 'RATE_LIMIT';
    throw err;
  }

  // Invalidate previous unused codes for this member.
  await db.prepare(`
    UPDATE password_reset_codes SET used_at = CURRENT_TIMESTAMP
    WHERE member_id = ? AND used_at IS NULL
  `).run(memberId);

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  // mysql2 accepts JS Date; format to MySQL DATETIME for safety.
  const expiresStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

  await db.prepare(`
    INSERT INTO password_reset_codes (member_id, code_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(memberId, codeHash, expiresStr);

  return code;
}

export async function verifyAndConsume(memberId, code) {
  const row = await db.prepare(`
    SELECT id, code_hash, expires_at, attempts FROM password_reset_codes
    WHERE member_id = ? AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(memberId);
  if (!row) return { ok: false, reason: 'NO_CODE' };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.prepare(`UPDATE password_reset_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).run(row.id);
    return { ok: false, reason: 'EXPIRED' };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.prepare(`UPDATE password_reset_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).run(row.id);
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
  }

  const match = await bcrypt.compare(code, row.code_hash);
  if (!match) {
    await db.prepare(`UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    return { ok: false, reason: 'INVALID', attemptsLeft: MAX_ATTEMPTS - row.attempts - 1 };
  }

  await db.prepare(`UPDATE password_reset_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).run(row.id);
  return { ok: true };
}
