import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const GET = withPermission('members:manage', async (request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ error: '請指定活動ID' }, { status: 400 });
  }

  const members = await db.prepare(`
    SELECT m.id, m.name, m.phone, m.email, m.created_at
    FROM members m
    WHERE m.is_disabled = 0
      AND m.id NOT IN (
        SELECT r.member_id FROM registrations r
        WHERE r.event_id = ? AND r.status != 'cancelled'
      )
    ORDER BY m.name
  `).all(eventId);

  return NextResponse.json(members);
});
