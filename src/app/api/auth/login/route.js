import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { buildSessionPayload, createSessionResponse } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: '請填寫 Email 及密碼' }, { status: 400 });
    }

    const member = await db.prepare(
      'SELECT id, name, email, password, is_admin, admin_permissions, is_disabled FROM members WHERE email = ?'
    ).get(email.trim().toLowerCase());
    if (!member) {
      return NextResponse.json({ error: 'Email 或密碼錯誤' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, member.password);
    if (!valid) {
      return NextResponse.json({ error: 'Email 或密碼錯誤' }, { status: 401 });
    }
    if (member.is_disabled) {
      return NextResponse.json({ error: '此帳號已停用，請聯繫管理員' }, { status: 403 });
    }

    const payload = buildSessionPayload(member);
    return createSessionResponse(payload, {
      success: true,
      name: member.name,
      is_admin: payload.is_admin,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
