import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { validateEventPayload } from '@/lib/event-validation';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let query = `
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r
         JOIN members m ON m.id = r.member_id
         WHERE r.event_id = e.id AND r.status != 'cancelled' AND m.is_disabled = 0) as reg_count
    FROM events e
  `;
  const params = [];
  if (status) {
    query += ' WHERE e.status = ?';
    params.push(status);
  }
  query += ' ORDER BY e.start_date DESC';

  const events = await db.prepare(query).all(...params);

  // Batch-load items for all events in a single query, then group.
  if (events.length > 0) {
    const eventIds = events.map((e) => e.id);
    const placeholders = eventIds.map(() => '?').join(',');
    const allItems = await db
      .prepare(`SELECT * FROM event_items WHERE event_id IN (${placeholders}) ORDER BY event_id, sort_order, id`)
      .all(...eventIds);
    const itemsByEventId = new Map();
    for (const it of allItems) {
      if (!itemsByEventId.has(it.event_id)) itemsByEventId.set(it.event_id, []);
      itemsByEventId.get(it.event_id).push(it);
    }
    for (const ev of events) ev.items = itemsByEventId.get(ev.id) || [];
  }

  return NextResponse.json(events);
}

export const POST = withPermission('events:manage', async (request) => {
  try {
    const body = await request.json();
    const v = validateEventPayload(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const { name, description, start_date, end_date, registration_deadline, location, map_url, status, banner_color } = v.value;
    const items = body?.items;

    const eventId = await db.transaction(async (tx) => {
      const result = await tx.prepare(`
        INSERT INTO events (name, description, start_date, end_date, registration_deadline, location, map_url, status, banner_color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, description, start_date, end_date, registration_deadline, location, map_url, status, banner_color);

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
