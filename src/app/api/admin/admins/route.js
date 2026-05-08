import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export const GET = withAdminAuth(async () => {
  const admins = await db.prepare(
    "SELECT id, name, email, phone, created_at FROM members WHERE role = 'admin' ORDER BY created_at"
  ).all();
  return NextResponse.json({ admins });
});

export const POST = withAdminAuth(async (request) => {
  try {
    const { name, email, phone, password } = await request.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: '姓名、Email、密碼為必填' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '密碼至少需 6 碼' }, { status: 400 });
    }
    const normalized = String(email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
    }
    const phoneVal = phone ? String(phone).trim() : null;

    const existing = await db.prepare('SELECT id, role FROM members WHERE email = ?').get(normalized);
    if (existing) {
      return NextResponse.json({ error: '此 Email 已被使用' }, { status: 409 });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await db
      .prepare('INSERT INTO members (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)')
      .run(name, normalized, phoneVal, hash, 'admin');
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
