import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { verifyAndConsume } from '@/lib/reset-code';

export async function POST(request) {
  try {
    const { email, code, password } = await request.json();
    if (!email || !code || !password) {
      return NextResponse.json({ error: '欄位不可為空' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '新密碼至少需 6 碼' }, { status: 400 });
    }
    const normalized = String(email).trim().toLowerCase();
    const member = await db.prepare('SELECT id FROM members WHERE email = ?').get(normalized);
    if (!member) {
      return NextResponse.json({ error: '驗證碼錯誤或已失效' }, { status: 400 });
    }

    const result = await verifyAndConsume(member.id, String(code).trim());
    if (!result.ok) {
      const map = {
        NO_CODE: '請先申請驗證碼',
        EXPIRED: '驗證碼已過期，請重新申請',
        INVALID: result.attemptsLeft != null
          ? `驗證碼錯誤，還可嘗試 ${result.attemptsLeft} 次`
          : '驗證碼錯誤',
        TOO_MANY_ATTEMPTS: '錯誤次數過多，請重新申請驗證碼',
      };
      return NextResponse.json({ error: map[result.reason] || '驗證失敗' }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);
    await db.prepare('UPDATE members SET password = ? WHERE id = ?').run(hash, member.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
