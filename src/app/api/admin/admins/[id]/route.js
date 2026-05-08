import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export const DELETE = withAdminAuth(async (request, { params }) => {
  const targetId = parseInt(params.id);
  if (!targetId) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });

  // Prevent self-deletion: the caller must not delete their own account.
  if (request.session?.sub && Number(request.session.sub) === targetId) {
    return NextResponse.json({ error: '不能刪除自己的管理員帳號' }, { status: 400 });
  }

  // Don't allow deleting the last admin.
  const target = await db.prepare("SELECT id, role FROM members WHERE id = ?").get(targetId);
  if (!target || target.role !== 'admin') {
    return NextResponse.json({ error: '管理員不存在' }, { status: 404 });
  }
  const countRow = await db.prepare("SELECT COUNT(*) AS total FROM members WHERE role = 'admin'").get();
  if ((countRow?.total || 0) <= 1) {
    return NextResponse.json({ error: '無法刪除最後一位管理員' }, { status: 400 });
  }

  await db.prepare('DELETE FROM members WHERE id = ?').run(targetId);
  return NextResponse.json({ success: true });
});

// Self-only password change. Requires the caller to be the same admin and to
// supply the current password.
export const PATCH = withAdminAuth(async (request, { params }) => {
  try {
    const targetId = parseInt(params.id);
    if (!targetId) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    if (Number(request.session?.sub) !== targetId) {
      return NextResponse.json({ error: '只能修改自己的密碼' }, { status: 403 });
    }
    const { old_password, new_password } = await request.json();
    if (!old_password || !new_password) {
      return NextResponse.json({ error: '請輸入舊密碼與新密碼' }, { status: 400 });
    }
    if (String(new_password).length < 6) {
      return NextResponse.json({ error: '新密碼至少需 6 碼' }, { status: 400 });
    }
    const me = await db.prepare("SELECT id, password FROM members WHERE id = ? AND role = 'admin'").get(targetId);
    if (!me) return NextResponse.json({ error: '管理員不存在' }, { status: 404 });
    const ok = await bcrypt.compare(old_password, me.password);
    if (!ok) return NextResponse.json({ error: '舊密碼不正確' }, { status: 401 });
    const hash = await bcrypt.hash(new_password, 10);
    await db.prepare('UPDATE members SET password = ? WHERE id = ?').run(hash, targetId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
