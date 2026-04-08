import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { createSessionResponse } from '@/lib/auth';

export async function POST(request) {
  try {
    const { name, phone, email, password } = await request.json();

    if (!name || !phone || !password) {
      return NextResponse.json({ error: '姓名、電話及密碼為必填' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '密碼至少需6碼' }, { status: 400 });
    }

    const existing = db.prepare('SELECT id FROM members WHERE phone = ?').get(phone);
    if (existing) {
      return NextResponse.json({ error: '此電話號碼已註冊' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = db
      .prepare('INSERT INTO members (name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)')
      .run(name, phone, email || null, hash, 'member');

    return createSessionResponse(
      { sub: result.lastInsertRowid, name, phone, role: 'member' },
      { success: true, name, role: 'member' },
      false
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
