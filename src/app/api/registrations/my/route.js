import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export const GET = withAuth(async (request) => {
  const memberId = request.session.sub;

  const registrations = db.prepare(`
    SELECT r.*, e.name as event_name, e.start_date, e.end_date, e.location, e.banner_color
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE r.member_id = ?
    ORDER BY r.created_at DESC
  `).all(memberId);

  for (const reg of registrations) {
    reg.items = db.prepare(`
      SELECT ri.*, ei.name as item_name, ei.price as item_price
      FROM registration_items ri
      JOIN event_items ei ON ei.id = ri.event_item_id
      WHERE ri.registration_id = ?
    `).all(reg.id);
  }

  return NextResponse.json(registrations);
});
