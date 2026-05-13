import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { buildSessionPayload, createSessionResponse } from '@/lib/auth';
import {
  checkLoginThrottle,
  clearLoginFailures,
  clientIp,
  recordLoginAttempt,
} from '@/lib/rate-limit';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: '請填寫 Email 及密碼' }, { status: 400 });
    }

    const normalized = String(email).trim().toLowerCase();
    const ip = clientIp(request);
    const emailKey = `email:${normalized}`;
    const ipKey = `ip:${ip}`;

    const throttle = await checkLoginThrottle([emailKey, ipKey]);
    if (throttle.blocked) {
      return NextResponse.json(
        { error: '嘗試次數過多，請稍後再試' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSec) } }
      );
    }

    const member = await db.prepare(
      'SELECT id, name, email, password, is_admin, admin_permissions, is_disabled FROM members WHERE email = ?'
    ).get(normalized);

    const valid = member ? await bcrypt.compare(password, member.password) : false;
    // Treat disabled accounts as a generic auth failure here so we don't leak
    // which emails are registered-but-disabled. They still see a clear message
    // on the next successful credential check, just not via this endpoint.
    if (!member || !valid || member.is_disabled) {
      await recordLoginAttempt(emailKey, false);
      await recordLoginAttempt(ipKey, false);
      return NextResponse.json({ error: 'Email 或密碼錯誤' }, { status: 401 });
    }

    await recordLoginAttempt(emailKey, true);
    await clearLoginFailures([emailKey, ipKey]);

    const payload = buildSessionPayload(member);
    return createSessionResponse(payload, {
      success: true,
      name: member.name,
      is_admin: payload.is_admin,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
