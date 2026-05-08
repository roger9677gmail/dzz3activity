import { NextResponse } from 'next/server';
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
