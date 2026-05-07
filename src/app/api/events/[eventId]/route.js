import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export async function GET(request, { params }) {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(params.eventId);
  if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

  event.items = db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(event.id);
  return NextResponse.json(event);
}

export const PUT = withAdminAuth(async (request, { params }) => {
  try {
    const { name, description, start_date, end_date, registration_deadline, location, status, max_capacity, banner_color } = await request.json();

    db.prepare(`
      UPDATE events SET name=?, description=?, start_date=?, end_date=?, registration_deadline=?,
        location=?, status=?, max_capacity=?, banner_color=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(name, description || null, start_date, end_date, registration_deadline, location || null, status, max_capacity || null, banner_color || '#8B1A1A', params.eventId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

export const DELETE = withAdminAuth(async (request, { params }) => {
  try {
    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(params.eventId);
    if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

    const { count } = db.prepare(
      "SELECT COUNT(*) AS count FROM registrations WHERE event_id = ? AND status != 'cancelled'"
    ).get(params.eventId);

    if (count > 0) {
      return NextResponse.json(
        { error: `此活動已有 ${count} 筆報名紀錄，無法刪除` },
        { status: 409 }
      );
    }

    const tx = db.transaction((eventId) => {
      db.prepare('DELETE FROM registrations WHERE event_id = ?').run(eventId);
      db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    });
    tx(params.eventId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
