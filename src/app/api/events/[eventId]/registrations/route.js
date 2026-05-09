import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const GET = withPermission('registrations:manage', async (request, { params }) => {
  const { searchParams } = new URL(request.url);
  const paymentStatus = searchParams.get('payment_status');
  const search = searchParams.get('search');

  let query = `
    SELECT r.*, m.name as member_name, m.phone as member_phone, m.email as member_email
    FROM registrations r
    JOIN members m ON m.id = r.member_id
    WHERE r.event_id = ?
  `;
  const queryParams = [params.eventId];

  if (paymentStatus) {
    query += ' AND r.payment_status = ?';
    queryParams.push(paymentStatus);
  }
  if (search) {
    query += ' AND (m.name LIKE ? OR m.phone LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY r.created_at DESC';

  const registrations = await db.prepare(query).all(...queryParams);

  for (const reg of registrations) {
    reg.items = await db.prepare(`
      SELECT ri.*, ei.name as item_name, ei.price as item_price
      FROM registration_items ri
      JOIN event_items ei ON ei.id = ri.event_item_id
      WHERE ri.registration_id = ?
    `).all(reg.id);
  }

  return NextResponse.json(registrations);
});
