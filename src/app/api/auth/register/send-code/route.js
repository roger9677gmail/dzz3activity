import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { issueCode } from '@/lib/email-verify';
import { sendRegisterVerificationCode } from '@/lib/mail';

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email 為必填' }, { status: 400 });

    const normalized = String(email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
    }

    const existing = await db.prepare('SELECT id FROM members WHERE email = ?').get(normalized);
    if (existing) {
      return NextResponse.json({ error: '此 Email 已註冊，請改用登入或忘記密碼' }, { status: 409 });
    }

    let code;
    try {
      code = await issueCode(normalized);
    } catch (err) {
      if (err.code === 'RATE_LIMIT') {
        return NextResponse.json({ error: err.message }, { status: 429 });
      }
      throw err;
    }

    try {
      await sendRegisterVerificationCode(normalized, code);
    } catch (err) {
      console.error('Failed to send verification email:', err);
      return NextResponse.json({ error: '寄送驗證信失敗，請稍後再試' }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: '驗證碼已寄出' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
