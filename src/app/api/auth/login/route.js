import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { createSessionResponse } from '@/lib/auth';

export async function POST(request) {
  try {
    const { phone, password } = await request.json();
    if (!phone || !password) {
      return NextResponse.json({ error: '請填寫電話及密碼' }, { status: 400 });
    }

    const member = db.prepare('SELECT * FROM members WHERE phone = ? AND role = ?').get(phone, 'member');
    if (!member) {
      return NextResponse.json({ error: '電話號碼或密碼錯誤' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, member.password);
    if (!valid) {
      return NextResponse.json({ error: '電話號碼或密碼錯誤' }, { status: 401 });
    }

    return createSessionResponse(
      { sub: member.id, name: member.name, phone: member.phone, role: 'member' },
      { success: true, name: member.name, role: 'member' },
      false
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
