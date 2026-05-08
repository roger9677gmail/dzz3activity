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

    const member = await db.prepare('SELECT * FROM members WHERE email = ? AND role = ?')
      .get(email.trim().toLowerCase(), 'member');
    if (!member) {
      return NextResponse.json({ error: 'Email 或密碼錯誤' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, member.password);
    if (!valid) {
      return NextResponse.json({ error: 'Email 或密碼錯誤' }, { status: 401 });
    }

    return createSessionResponse(
      { sub: member.id, name: member.name, email: member.email, role: 'member' },
      { success: true, name: member.name, role: 'member' },
      false
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
