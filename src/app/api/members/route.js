import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');

  let query = "SELECT id, name, phone, email, role, created_at FROM members WHERE role = 'member'";
  const params = [];
  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY name';

  const members = await db.prepare(query).all(...params);
  return NextResponse.json(members);
});
