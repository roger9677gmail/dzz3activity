import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export async function GET(request, { params }) {
  const items = db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(params.eventId);
  return NextResponse.json(items);
}

export const POST = withAdminAuth(async (request, { params }) => {
  const { name, description, price, max_quantity, requires_name, sort_order } = await request.json();
  if (!name) return NextResponse.json({ error: '項目名稱為必填' }, { status: 400 });

  const result = db.prepare(`
    INSERT INTO event_items (event_id, name, description, price, max_quantity, requires_name, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(params.eventId, name, description || null, price || 0, max_quantity || 5, requires_name ? 1 : 0, sort_order || 0);

  return NextResponse.json({ success: true, id: result.lastInsertRowid });
});

export const PUT = withAdminAuth(async (request, { params }) => {
  // Bulk update items for an event (replace all)
  const { items } = await request.json();

  const updateItems = db.transaction((eventId, items) => {
    db.prepare('DELETE FROM event_items WHERE event_id = ?').run(eventId);
    for (const [i, item] of items.entries()) {
      db.prepare(`
        INSERT INTO event_items (event_id, name, description, price, max_quantity, requires_name, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(eventId, item.name, item.description || null, item.price || 0, item.max_quantity || 5, item.requires_name ? 1 : 0, i);
    }
  });

  updateItems(params.eventId, items || []);
  return NextResponse.json({ success: true });
});
