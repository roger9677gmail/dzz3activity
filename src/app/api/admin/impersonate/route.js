import { NextResponse } from 'next/server';
import db from '@/lib/db';
import {
  getSession,
  hasPermission,
  buildSessionPayload,
  createSessionResponse,
  IMPERSONATION_TTL,
} from '@/lib/auth';

// POST /api/admin/impersonate
// Body: { target_id: number, mode: 'read' | 'write' }
//
// Bypasses the standard withPermission wrapper because we need access to the
// raw request headers for the audit log (IP + UA) and because session
// validation here is intentionally manual: the caller MUST be a non-
// impersonating admin (you can't impersonate from inside an impersonation
// session — bail and end first).
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    if (session.imp) {
      return NextResponse.json(
        { error: '已在模擬中，請先結束目前的模擬再開新一輪' },
        { status: 409 }
      );
    }
    if (!hasPermission(session, 'members:impersonate')) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const targetId = parseInt(body.target_id);
    const mode = body.mode === 'write' ? 'write' : 'read';
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return NextResponse.json({ error: '無效的 target_id' }, { status: 400 });
    }
    if (targetId === session.sub) {
      return NextResponse.json({ error: '不能模擬自己' }, { status: 400 });
    }

    // Verify the admin row is still active (the cookie alone is not enough).
    const admin = await db
      .prepare('SELECT id, name, email, is_admin, is_disabled FROM members WHERE id = ?')
      .get(session.sub);
    if (!admin || admin.is_disabled || !admin.is_admin) {
      return NextResponse.json({ error: '管理員帳號無效' }, { status: 403 });
    }

    const target = await db
      .prepare(
        'SELECT id, name, email, is_admin, admin_permissions, is_disabled FROM members WHERE id = ?'
      )
      .get(targetId);
    if (!target) {
      return NextResponse.json({ error: '目標師兄姐不存在' }, { status: 404 });
    }
    if (target.is_disabled) {
      return NextResponse.json({ error: '不能模擬已停用的帳號' }, { status: 400 });
    }

    // Audit log: insert first so we have an id to embed in the JWT.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '';
    const ua = (request.headers.get('user-agent') || '').slice(0, 500);
    const logResult = await db
      .prepare(
        'INSERT INTO impersonation_logs (admin_id, target_id, mode, ip, user_agent) VALUES (?, ?, ?, ?, ?)'
      )
      .run(admin.id, target.id, mode, ip || null, ua || null);
    const logId = logResult.lastInsertRowid;

    const imp = {
      admin_id: admin.id,
      admin_name: admin.name,
      log_id: logId,
      mode,
      started_at: Date.now(),
    };

    const payload = buildSessionPayload(target, imp);
    return createSessionResponse(
      payload,
      {
        success: true,
        target: { id: target.id, name: target.name, email: target.email },
        mode,
      },
      { expiresIn: IMPERSONATION_TTL, maxAge: 60 * 60 * 2 }
    );
  } catch (err) {
    console.error('[impersonate POST] failed:', err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
