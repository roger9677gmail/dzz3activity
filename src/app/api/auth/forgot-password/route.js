import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { issueCode } from '@/lib/reset-code';
import { sendVerificationCode } from '@/lib/mail';

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: '請輸入 Email' }, { status: 400 });
    }
    const normalized = String(email).trim().toLowerCase();

    const member = await db.prepare('SELECT id, email FROM members WHERE email = ?').get(normalized);

    // Always return success to avoid leaking which emails are registered.
    if (!member) {
      return NextResponse.json({ success: true });
    }

    let code;
    try {
      code = await issueCode(member.id);
    } catch (err) {
      if (err.code === 'RATE_LIMIT') {
        return NextResponse.json({ error: err.message }, { status: 429 });
      }
      throw err;
    }

    try {
      await sendVerificationCode(member.email, code);
    } catch (mailErr) {
      console.error('mail send failed:', mailErr);
      return NextResponse.json({ error: '寄送驗證信失敗，請稍後再試' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
