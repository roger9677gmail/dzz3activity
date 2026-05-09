import { NextResponse } from 'next/server';
import db from './db';
import { getSession, hasPermission } from './auth';

// Verifies the cookie session AND that the underlying member is still active
// (not disabled). Returns the member row when valid, or a NextResponse to
// short-circuit the request when not.
async function loadActiveMember(session) {
  if (!session) {
    return { error: NextResponse.json({ error: '請先登入' }, { status: 401 }) };
  }
  const member = await db
    .prepare('SELECT id, is_admin, is_disabled FROM members WHERE id = ?')
    .get(session.sub);
  if (!member) {
    return { error: NextResponse.json({ error: '請先登入' }, { status: 401 }) };
  }
  if (member.is_disabled) {
    return { error: NextResponse.json({ error: '帳號已停用' }, { status: 403 }) };
  }
  return { member };
}

export function withAuth(handler) {
  return async function (request, context) {
    const session = await getSession();
    const { error } = await loadActiveMember(session);
    if (error) return error;
    request.session = session;
    return handler(request, context);
  };
}

// Any admin (is_admin=1) regardless of specific permissions.
export function withAdminAuth(handler) {
  return async function (request, context) {
    const session = await getSession();
    const { error } = await loadActiveMember(session);
    if (error) return error;
    if (!session?.is_admin) {
      return NextResponse.json({ error: '無管理員權限' }, { status: 403 });
    }
    request.session = session;
    return handler(request, context);
  };
}

export function withPermission(perm, handler) {
  return async function (request, context) {
    const session = await getSession();
    const { error } = await loadActiveMember(session);
    if (error) return error;
    if (!session?.is_admin) {
      return NextResponse.json({ error: '無管理員權限' }, { status: 403 });
    }
    if (!hasPermission(session, perm)) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }
    request.session = session;
    return handler(request, context);
  };
}
