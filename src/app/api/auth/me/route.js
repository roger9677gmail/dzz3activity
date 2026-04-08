import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';

export async function GET() {
  const session = await getSession(false);
  if (!session) return NextResponse.json({ user: null });

  const member = db.prepare('SELECT id, name, phone, email, role, created_at FROM members WHERE id = ?').get(session.sub);
  if (!member) return NextResponse.json({ user: null });
  return NextResponse.json({ user: member });
}
