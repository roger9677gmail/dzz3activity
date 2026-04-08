import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ error: '請指定活動ID' }, { status: 400 });
  }

  const members = db.prepare(`
    SELECT m.id, m.name, m.phone, m.email, m.created_at
    FROM members m
    WHERE m.role = 'member'
      AND m.id NOT IN (
        SELECT r.member_id FROM registrations r
        WHERE r.event_id = ? AND r.status != 'cancelled'
      )
    ORDER BY m.name
  `).all(eventId);

  return NextResponse.json(members);
});
