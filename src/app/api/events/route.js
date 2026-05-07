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
    const { name, description, start_date, end_date, registration_deadline, location, status, max_capacity, banner_color, items } = await request.json();

    if (!name || !start_date || !end_date || !registration_deadline) {
      return NextResponse.json({ error: '活動名稱、日期及報名截止日為必填' }, { status: 400 });
    }

    const eventId = await db.transaction(async (tx) => {
      const result = await tx.prepare(`
        INSERT INTO events (name, description, start_date, end_date, registration_deadline, location, status, max_capacity, banner_color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, description || null, start_date, end_date, registration_deadline, location || null, status || 'active', max_capacity || null, banner_color || '#8B1A1A');

      const newId = result.lastInsertRowid;

      if (items && Array.isArray(items)) {
        for (const [i, item] of items.entries()) {
          await tx.prepare(`
            INSERT INTO event_items (event_id, name, description, price, max_quantity, requires_name, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(newId, item.name, item.description || null, item.price || 0, item.max_quantity || 5, item.requires_name ? 1 : 0, i);
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
