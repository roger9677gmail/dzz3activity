import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export async function GET(request, { params }) {
  const items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(params.eventId);
  return NextResponse.json(items);
}

export const POST = withAdminAuth(async (request, { params }) => {
  const { name, description, price, requires_name, requires_content, sort_order } = await request.json();
  if (!name) return NextResponse.json({ error: '項目名稱為必填' }, { status: 400 });

  const result = await db.prepare(`
    INSERT INTO event_items (event_id, name, description, price, requires_name, requires_content, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(params.eventId, name, description || null, price || 0, requires_name ? 1 : 0, requires_content ? 1 : 0, sort_order || 0);

  return NextResponse.json({ success: true, id: result.lastInsertRowid });
});

export const PUT = withAdminAuth(async (request, { params }) => {
  // Bulk update items for an event (replace all)
  const { items } = await request.json();
  const eventId = params.eventId;
  const list = items || [];

  await db.transaction(async (tx) => {
    // Clear gift FK first so DELETE doesn't trip on self-reference, then drop & re-insert.
    await tx.prepare('UPDATE event_items SET gift_event_item_id = NULL WHERE event_id = ?').run(eventId);
    await tx.prepare('DELETE FROM event_items WHERE event_id = ?').run(eventId);
    // Two-pass insert so gift_event_item_id can reference newly-inserted ids.
    const uidToId = {};
    for (const [i, item] of list.entries()) {
      const r = await tx.prepare(`
        INSERT INTO event_items (event_id, name, description, price, requires_name, requires_content, sort_order, gift_quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(eventId, item.name, item.description || null, item.price || 0,
             item.requires_name ? 1 : 0, item.requires_content ? 1 : 0, i,
             Number.isFinite(item.gift_quantity) ? Math.max(0, parseInt(item.gift_quantity)) : 0);
      if (item._uid) uidToId[item._uid] = r.lastInsertRowid;
    }
    for (const item of list) {
      const qty = Number.isFinite(item.gift_quantity) ? parseInt(item.gift_quantity) : 0;
      if (qty > 0 && item.gift_uid && item._uid && uidToId[item.gift_uid] && uidToId[item._uid]) {
        await tx.prepare('UPDATE event_items SET gift_event_item_id = ? WHERE id = ?')
          .run(uidToId[item.gift_uid], uidToId[item._uid]);
      }
    }
  });

  return NextResponse.json({ success: true });
});
