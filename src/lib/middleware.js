import { NextResponse } from 'next/server';
import db from './db';
import { getSession, hasPermission, parsePermissions } from './auth';

// Verifies the cookie session AND that the underlying member is still active.
// Re-reads is_admin / admin_permissions from the DB on every request so that
// revoking admin rights or disabling an account takes effect immediately,
// even on tokens issued before the change.
async function loadActiveMember(session) {
  if (!session) {
    return { error: NextResponse.json({ error: '請先登入' }, { status: 401 }) };
  }
  const member = await db
    .prepare('SELECT id, is_admin, admin_permissions, is_disabled FROM members WHERE id = ?')
    .get(session.sub);
  if (!member) {
    return { error: NextResponse.json({ error: '請先登入' }, { status: 401 }) };
  }
  if (member.is_disabled) {
    return { error: NextResponse.json({ error: '帳號已停用' }, { status: 403 }) };
  }
  return { member };
}

// Overlay the DB-current is_admin / permissions onto the cached session
// so route handlers see authoritative values, not the snapshot from
// token-issue time.
function syncSession(session, member) {
  session.is_admin = member.is_admin ? 1 : 0;
  session.permissions = parsePermissions(member.admin_permissions);
}

export function withAuth(handler) {
  return async function (request, context) {
    const session = await getSession();
    const { error, member } = await loadActiveMember(session);
    if (error) return error;
    syncSession(session, member);
    request.session = session;
    return handler(request, context);
  };
}

// Any admin (is_admin=1) regardless of specific permissions.
export function withAdminAuth(handler) {
  return async function (request, context) {
    const session = await getSession();
    const { error, member } = await loadActiveMember(session);
    if (error) return error;
    syncSession(session, member);
    if (!session.is_admin) {
      return NextResponse.json({ error: '無管理員權限' }, { status: 403 });
    }
    request.session = session;
    return handler(request, context);
  };
}

export function withPermission(perm, handler) {
  return async function (request, context) {
    const session = await getSession();
    const { error, member } = await loadActiveMember(session);
    if (error) return error;
    syncSession(session, member);
    if (!session.is_admin) {
      return NextResponse.json({ error: '無管理員權限' }, { status: 403 });
    }
    if (!hasPermission(session, perm)) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }
    request.session = session;
    return handler(request, context);
  };
}
