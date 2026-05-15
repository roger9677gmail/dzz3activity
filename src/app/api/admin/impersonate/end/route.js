import { NextResponse } from 'next/server';
import db from '@/lib/db';
import {
  getSession,
  buildSessionPayload,
  createSessionResponse,
} from '@/lib/auth';

// POST /api/admin/impersonate/end
// Restores the admin session that originally launched the impersonation
// (stored in session.imp.admin_id), closes out the audit log row, and
// resets the cookie to the admin's regular 7d session.
//
// Bypasses the standard wrappers — read-only mode would otherwise block
// this POST and trap the admin in a session they cannot exit.
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    if (!session.imp?.admin_id) {
      return NextResponse.json({ error: '目前並非模擬中' }, { status: 400 });
    }

    const admin = await db
      .prepare(
        'SELECT id, name, email, is_admin, admin_permissions, is_disabled FROM members WHERE id = ?'
      )
      .get(session.imp.admin_id);
    if (!admin || admin.is_disabled || !admin.is_admin) {
      // Original admin lost their access mid-session; bounce out entirely.
      const res = NextResponse.json(
        { error: '原管理員帳號已停用或撤權，請重新登入' },
        { status: 403 }
      );
      res.cookies.set('temple_session', '', { maxAge: 0, path: '/' });
      return res;
    }

    // Close the audit log row (best-effort; don't fail the request if it errors).
    if (session.imp.log_id) {
      try {
        await db
          .prepare('UPDATE impersonation_logs SET ended_at = NOW() WHERE id = ? AND ended_at IS NULL')
          .run(session.imp.log_id);
      } catch (err) {
        console.error('[impersonate end] log close failed:', err);
      }
    }

    const payload = buildSessionPayload(admin);
    return createSessionResponse(payload, { success: true, restored: { id: admin.id, name: admin.name } });
  } catch (err) {
    console.error('[impersonate end] failed:', err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
