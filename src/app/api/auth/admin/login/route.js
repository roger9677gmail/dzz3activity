import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { createSessionResponse } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: '請填寫 Email 及密碼' }, { status: 400 });
    }

    const admin = await db.prepare('SELECT * FROM members WHERE email = ? AND role = ?')
      .get(email.trim().toLowerCase(), 'admin');
    if (!admin) {
      return NextResponse.json({ error: 'Email 或密碼錯誤' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return NextResponse.json({ error: 'Email 或密碼錯誤' }, { status: 401 });
    }

    return createSessionResponse(
      { sub: admin.id, name: admin.name, email: admin.email, role: 'admin' },
      { success: true, name: admin.name },
      true
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
