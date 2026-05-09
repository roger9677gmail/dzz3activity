import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { parsePermissions } from '@/lib/auth';

const KNOWN_PERMS = new Set([
  '*',
  'events:manage',
  'registrations:manage',
  'members:manage',
  'locations:manage',
  'admins:manage',
  'reports:view',
  'notifications:send',
  'practices:manage',
]);

function sanitizePermissions(input) {
  if (!Array.isArray(input)) return [];
  const cleaned = [];
  for (const p of input) {
    if (typeof p !== 'string') continue;
    const trimmed = p.trim();
    if (!trimmed || !KNOWN_PERMS.has(trimmed)) continue;
    if (!cleaned.includes(trimmed)) cleaned.push(trimmed);
  }
  return cleaned;
}

export const GET = withPermission('admins:manage', async () => {
  const rows = await db.prepare(
    'SELECT id, name, email, phone, admin_permissions, created_at FROM members WHERE is_admin = 1 ORDER BY created_at'
  ).all();
  const admins = rows.map((a) => ({ ...a, admin_permissions: parsePermissions(a.admin_permissions) }));
  return NextResponse.json({ admins });
});

export const POST = withPermission('admins:manage', async (request) => {
  try {
    const { name, email, phone, password, permissions } = await request.json();
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
    const perms = sanitizePermissions(permissions);

    const existing = await db.prepare('SELECT id FROM members WHERE email = ?').get(normalized);
    if (existing) {
      return NextResponse.json({ error: '此 Email 已被使用' }, { status: 409 });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await db
      .prepare(
        'INSERT INTO members (name, email, phone, password, role, is_admin, admin_permissions) VALUES (?, ?, ?, ?, ?, 1, ?)'
      )
      .run(name, normalized, phoneVal, hash, 'admin', JSON.stringify(perms));
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
