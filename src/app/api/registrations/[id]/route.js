import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export const GET = withAdminAuth(async (request, { params }) => {
  const reg = await db.prepare(`
    SELECT r.*, m.name as member_name, m.phone as member_phone, m.email as member_email,
           e.name as event_name, e.start_date, e.end_date
    FROM registrations r
    JOIN members m ON m.id = r.member_id
    JOIN events e ON e.id = r.event_id
    WHERE r.id = ?
  `).get(params.id);

  if (!reg) return NextResponse.json({ error: '報名記錄不存在' }, { status: 404 });

  reg.items = await db.prepare(`
    SELECT ri.*, ei.name as item_name, ei.price as item_price
    FROM registration_items ri
    JOIN event_items ei ON ei.id = ri.event_item_id
    WHERE ri.registration_id = ?
  `).all(reg.id);

  return NextResponse.json(reg);
});

export const PUT = withAdminAuth(async (request, { params }) => {
  const { status, notes } = await request.json();
  await db.prepare(`
    UPDATE registrations SET status=?, notes=?, updated_at=NOW()
    WHERE id=?
  `).run(status, notes || null, params.id);
  return NextResponse.json({ success: true });
});
