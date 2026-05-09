import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { withAuth, withPermission } from '@/lib/middleware';

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

async function ensureNotLastAdmin(targetId) {
  const countRow = await db.prepare('SELECT COUNT(*) AS total FROM members WHERE is_admin = 1').get();
  return (countRow?.total || 0) > 1;
}

// DELETE: revoke admin status (keeps the member row, drops privileges).
// Use revoke rather than hard-delete so registrations & history are preserved.
export const DELETE = withPermission('admins:manage', async (request, { params }) => {
  const targetId = parseInt(params.id);
  if (!targetId) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  if (Number(request.session?.sub) === targetId) {
    return NextResponse.json({ error: '不能撤銷自己的管理員權限' }, { status: 400 });
  }
  const target = await db.prepare('SELECT id, is_admin FROM members WHERE id = ?').get(targetId);
  if (!target || !target.is_admin) {
    return NextResponse.json({ error: '管理員不存在' }, { status: 404 });
  }
  if (!(await ensureNotLastAdmin(targetId))) {
    return NextResponse.json({ error: '無法撤銷最後一位管理員' }, { status: 400 });
  }
  await db.prepare(
    "UPDATE members SET is_admin = 0, admin_permissions = NULL, role = 'member' WHERE id = ?"
  ).run(targetId);
  return NextResponse.json({ success: true });
});

// PATCH dispatches by payload shape:
//  - { old_password, new_password } → self-only password change (any signed-in user)
//  - { permissions: [...] }          → admins:manage; replace target's permissions
export const PATCH = withAuth(async (request, { params }) => {
  try {
    const targetId = parseInt(params.id);
    if (!targetId) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    const body = await request.json();
    const session = request.session;

    if (body.old_password !== undefined || body.new_password !== undefined) {
      if (Number(session.sub) !== targetId) {
        return NextResponse.json({ error: '只能修改自己的密碼' }, { status: 403 });
      }
      const { old_password, new_password } = body;
      if (!old_password || !new_password) {
        return NextResponse.json({ error: '請輸入舊密碼與新密碼' }, { status: 400 });
      }
      if (String(new_password).length < 6) {
        return NextResponse.json({ error: '新密碼至少需 6 碼' }, { status: 400 });
      }
      const me = await db.prepare('SELECT id, password FROM members WHERE id = ?').get(targetId);
      if (!me) return NextResponse.json({ error: '帳號不存在' }, { status: 404 });
      const ok = await bcrypt.compare(old_password, me.password);
      if (!ok) return NextResponse.json({ error: '舊密碼不正確' }, { status: 401 });
      const hash = await bcrypt.hash(new_password, 10);
      await db.prepare('UPDATE members SET password = ? WHERE id = ?').run(hash, targetId);
      return NextResponse.json({ success: true });
    }

    if (Array.isArray(body.permissions)) {
      if (!session.is_admin) {
        return NextResponse.json({ error: '無管理員權限' }, { status: 403 });
      }
      const perms = (session.permissions || []);
      if (!perms.includes('*') && !perms.includes('admins:manage')) {
        return NextResponse.json({ error: '權限不足' }, { status: 403 });
      }
      const target = await db.prepare('SELECT id, is_admin FROM members WHERE id = ?').get(targetId);
      if (!target) return NextResponse.json({ error: '帳號不存在' }, { status: 404 });
      const cleaned = sanitizePermissions(body.permissions);
      await db.prepare(
        "UPDATE members SET is_admin = 1, role = 'admin', admin_permissions = ? WHERE id = ?"
      ).run(JSON.stringify(cleaned), targetId);
      return NextResponse.json({ success: true, permissions: cleaned });
    }

    return NextResponse.json({ error: '請提供合法的更新內容' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
