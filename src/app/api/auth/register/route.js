import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { createSessionResponse } from '@/lib/auth';
import { verifyAndConsume } from '@/lib/email-verify';

export async function POST(request) {
  try {
    const { name, email, phone, password, location_id, address, code } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: '姓名、Email 及密碼為必填' }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: '請輸入 Email 驗證碼' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: '密碼至少需 8 碼' }, { status: 400 });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
    }
    const phoneVal = phone ? String(phone).trim() : null;
    const addressVal = address ? String(address).trim() : null;
    const locationVal = location_id ? parseInt(location_id) : null;
    if (location_id && Number.isNaN(locationVal)) {
      return NextResponse.json({ error: '無效的道場' }, { status: 400 });
    }

    // Verify the email-verification code FIRST. For an already-registered
    // email, send-code never issued a code, so verifyAndConsume returns
    // NO_CODE — identical to the response a probing attacker would get for
    // a totally fresh email with an invalid code. This is what prevents
    // user enumeration via this endpoint.
    const verify = await verifyAndConsume(normalizedEmail, String(code).trim());
    if (!verify.ok) {
      const msg = {
        NO_CODE: '請先點「發送驗證碼」並至 Email 收信',
        EXPIRED: '驗證碼已過期，請重新發送',
        TOO_MANY_ATTEMPTS: '驗證碼錯誤次數過多，請重新發送',
        INVALID: `驗證碼錯誤${verify.attemptsLeft != null ? `（剩 ${verify.attemptsLeft} 次）` : ''}`,
      }[verify.reason] || '驗證碼錯誤';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Defence-in-depth: even though send-code refuses to issue codes for
    // existing emails, race or replay could still land here.
    const existingEmail = await db.prepare('SELECT id FROM members WHERE email = ?').get(normalizedEmail);
    if (existingEmail) {
      return NextResponse.json({ error: '註冊失敗，請改用登入或忘記密碼' }, { status: 409 });
    }
    if (phoneVal) {
      const existingPhone = await db.prepare('SELECT id FROM members WHERE phone = ?').get(phoneVal);
      if (existingPhone) {
        return NextResponse.json({ error: '此電話號碼已被其他帳號使用' }, { status: 409 });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db
      .prepare('INSERT INTO members (name, email, phone, location_id, address, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(name, normalizedEmail, phoneVal, locationVal, addressVal, hash, 'member');

    return createSessionResponse(
      { sub: result.lastInsertRowid, name, email: normalizedEmail, is_admin: 0, permissions: [] },
      { success: true, name, is_admin: 0 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
