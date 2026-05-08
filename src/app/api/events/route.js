import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let query = `
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'cancelled') as reg_count
    FROM events e
  `;
  const params = [];
  if (status) {
    query += ' WHERE e.status = ?';
    params.push(status);
  }
  query += ' ORDER BY e.start_date DESC';

  const events = await db.prepare(query).all(...params);

  // Attach items to each event
  for (const ev of events) {
    ev.items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(ev.id);
  }

  return NextResponse.json(events);
}

export const POST = withAdminAuth(async (request) => {
  try {
    const { name, description, start_date, end_date, registration_deadline, location, status, banner_color, items } = await request.json();

    if (!name || !start_date || !end_date || !registration_deadline) {
      return NextResponse.json({ error: '活動名稱、日期及報名截止日為必填' }, { status: 400 });
    }

    const eventId = await db.transaction(async (tx) => {
      const result = await tx.prepare(`
        INSERT INTO events (name, description, start_date, end_date, registration_deadline, location, status, banner_color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, description || null, start_date, end_date, registration_deadline, location || null, status || 'active', banner_color || '#8B1A1A');

      const newId = result.lastInsertRowid;

      if (items && Array.isArray(items)) {
        // Two-pass: insert items first (no gift FK), then resolve gift_uid → newly-inserted id.
        const uidToId = {};
        for (const [i, item] of items.entries()) {
          const r = await tx.prepare(`
            INSERT INTO event_items (event_id, name, description, price, allow_custom_price, requires_name, requires_content, sort_order, gift_quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(newId, item.name, item.description || null, item.price || 0,
                 item.allow_custom_price ? 1 : 0,
                 item.requires_name ? 1 : 0, item.requires_content ? 1 : 0, i,
                 Number.isFinite(item.gift_quantity) ? Math.max(0, parseInt(item.gift_quantity)) : 0);
          if (item._uid) uidToId[item._uid] = r.lastInsertRowid;
        }
        for (const item of items) {
          const qty = Number.isFinite(item.gift_quantity) ? parseInt(item.gift_quantity) : 0;
          if (qty > 0 && item.gift_uid && item._uid && uidToId[item.gift_uid] && uidToId[item._uid]) {
            await tx.prepare('UPDATE event_items SET gift_event_item_id = ? WHERE id = ?')
              .run(uidToId[item.gift_uid], uidToId[item._uid]);
          }
        }
      }
      return newId;
    });

    return NextResponse.json({ success: true, id: eventId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
