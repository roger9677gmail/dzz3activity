import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { createSessionResponse } from '@/lib/auth';

export async function POST(request) {
  try {
    const { phone, password } = await request.json();
    if (!phone || !password) {
      return NextResponse.json({ error: '請填寫帳號及密碼' }, { status: 400 });
    }

    const admin = await db.prepare('SELECT * FROM members WHERE phone = ? AND role = ?').get(phone, 'admin');
    if (!admin) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
    }

    return createSessionResponse(
      { sub: admin.id, name: admin.name, phone: admin.phone, role: 'admin' },
      { success: true, name: admin.name },
      true
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
