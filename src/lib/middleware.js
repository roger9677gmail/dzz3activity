import { NextResponse } from 'next/server';
import { getSession } from './auth';

export function withAuth(handler) {
  return async function (request, context) {
    const session = await getSession(false);
    if (!session) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    request.session = session;
    return handler(request, context);
  };
}

export function withAdminAuth(handler) {
  return async function (request, context) {
    const session = await getSession(true);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無管理員權限' }, { status: 403 });
    }
    request.session = session;
    return handler(request, context);
  };
}
