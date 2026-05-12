import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { isStaffOrAdmin } from '@/lib/staff-access';
import { safeParseJSON } from '@/lib/utils';

// Staff-only view of 祈福報名 for a single event.
// PII rule (chosen by admin): 金額 / 收據編號 等都隱藏，只露姓名/電話/地址/項目/超度內容/繳款狀態。
export const GET = withAuth(async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

  if (!(await isStaffOrAdmin(request.session, eventId))) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const event = await db.prepare('SELECT id, name FROM events WHERE id = ?').get(eventId);
  if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

  const regs = await db
    .prepare(
      `SELECT r.id, r.payment_status, r.created_at,
              m.name AS member_name, m.phone AS member_phone, m.address AS member_address,
              l.name AS location_name
         FROM registrations r
         JOIN members m ON m.id = r.member_id
    LEFT JOIN locations l ON l.id = m.location_id
        WHERE r.event_id = ? AND r.status != 'cancelled' AND m.is_disabled = 0
        ORDER BY m.name, r.id`
    )
    .all(eventId);

  if (regs.length > 0) {
    const ids = regs.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const items = await db
      .prepare(
        `SELECT ri.registration_id, ri.quantity, ri.names, ri.contents, ri.is_gift,
                ei.name AS item_name
           FROM registration_items ri
           JOIN event_items ei ON ei.id = ri.event_item_id
          WHERE ri.registration_id IN (${placeholders})
          ORDER BY ri.registration_id, ri.is_gift, ri.id`
      )
      .all(...ids);
    const byReg = new Map();
    for (const it of items) {
      if (!byReg.has(it.registration_id)) byReg.set(it.registration_id, []);
      byReg.get(it.registration_id).push({
        item_name: it.item_name,
        quantity: it.quantity,
        is_gift: it.is_gift,
        names: safeParseJSON(it.names),
        contents: safeParseJSON(it.contents),
      });
    }
    for (const r of regs) r.items = byReg.get(r.id) || [];
  }

  return NextResponse.json({ event, registrations: regs });
});
