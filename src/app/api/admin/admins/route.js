import { NextResponse } from 'next/server';
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
  'announcements:manage',
  'groups:manage',
  'attendance:manage',
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

// POST: promote an existing 師兄姐 to admin.
// Body: { member_id, permissions }
// (Previously this created a brand-new account; admins are now always
// drawn from the existing member roster so credentials & profiles stay
// owned by the member.)
export const POST = withPermission('admins:manage', async (request) => {
  try {
    const { member_id, permissions } = await request.json();
    const memberId = parseInt(member_id);
    if (!memberId) {
      return NextResponse.json({ error: '請選擇要指派的師兄姐' }, { status: 400 });
    }

    const member = await db
      .prepare('SELECT id, name, email, is_admin, is_disabled FROM members WHERE id = ?')
      .get(memberId);
    if (!member) {
      return NextResponse.json({ error: '師兄姐不存在' }, { status: 404 });
    }
    if (member.is_disabled) {
      return NextResponse.json({ error: '此師兄姐帳號已停用，請先啟用後再指派' }, { status: 400 });
    }
    if (member.is_admin) {
      return NextResponse.json({ error: '此師兄姐已是管理員' }, { status: 409 });
    }

    const perms = sanitizePermissions(permissions);
    await db
      .prepare(
        "UPDATE members SET is_admin = 1, role = 'admin', admin_permissions = ? WHERE id = ?"
      )
      .run(JSON.stringify(perms), memberId);

    return NextResponse.json({ success: true, id: memberId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
