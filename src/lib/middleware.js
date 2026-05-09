import { NextResponse } from 'next/server';
import { getSession, hasPermission } from './auth';

export function withAuth(handler) {
  return async function (request, context) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    request.session = session;
    return handler(request, context);
  };
}

// Any admin (is_admin=1) regardless of specific permissions. Use this for
// routes that any admin should reach (e.g. /api/admin/stats overview).
export function withAdminAuth(handler) {
  return async function (request, context) {
    const session = await getSession();
    if (!session?.is_admin) {
      return NextResponse.json({ error: '無管理員權限' }, { status: 403 });
    }
    request.session = session;
    return handler(request, context);
  };
}

// Gate by a specific permission key. Wildcard '*' grants everything.
export function withPermission(perm, handler) {
  return async function (request, context) {
    const session = await getSession();
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
