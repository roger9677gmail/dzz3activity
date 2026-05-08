import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { createSessionResponse } from '@/lib/auth';

export async function POST(request) {
  try {
    const { name, email, phone, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: '姓名、Email 及密碼為必填' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '密碼至少需6碼' }, { status: 400 });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
    }
    const phoneVal = phone ? String(phone).trim() : null;

    const existingEmail = await db.prepare('SELECT id FROM members WHERE email = ?').get(normalizedEmail);
    if (existingEmail) {
      return NextResponse.json({ error: '此 Email 已註冊' }, { status: 409 });
    }
    if (phoneVal) {
      const existingPhone = await db.prepare('SELECT id FROM members WHERE phone = ?').get(phoneVal);
      if (existingPhone) {
        return NextResponse.json({ error: '此電話號碼已被其他帳號使用' }, { status: 409 });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db
      .prepare('INSERT INTO members (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)')
      .run(name, normalizedEmail, phoneVal, hash, 'member');

    return createSessionResponse(
      { sub: result.lastInsertRowid, name, email: normalizedEmail, role: 'member' },
      { success: true, name, role: 'member' },
      false
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
