import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const GET = withPermission('members:manage', async (request) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');

  let query = "SELECT id, name, phone, email, is_admin, admin_permissions, created_at FROM members WHERE is_admin = 0";
  const params = [];
  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY name';

  const members = await db.prepare(query).all(...params);
  return NextResponse.json(members);
});
