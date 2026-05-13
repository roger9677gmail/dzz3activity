import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { validateEventPayload } from '@/lib/event-validation';

export async function GET(request, { params }) {
  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(params.eventId);
  if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

  event.items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(event.id);
  return NextResponse.json(event);
}

export const PUT = withPermission('events:manage', async (request, { params }) => {
  try {
    const body = await request.json();
    const v = validateEventPayload(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const { name, description, start_date, end_date, registration_deadline, location, map_url, status, banner_color } = v.value;

    await db.prepare(`
      UPDATE events SET name=?, description=?, start_date=?, end_date=?, registration_deadline=?,
        location=?, map_url=?, status=?, banner_color=?, updated_at=NOW()
      WHERE id=?
    `).run(name, description, start_date, end_date, registration_deadline, location, map_url, status, banner_color, params.eventId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

export const DELETE = withPermission('events:manage', async (request, { params }) => {
  try {
    const event = await db.prepare('SELECT id FROM events WHERE id = ?').get(params.eventId);
    if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

    // 只擋「已繳款」的報名；未繳款的會隨活動刪除一併移除
    const paidRow = await db.prepare(
      "SELECT COUNT(*) AS count FROM registrations WHERE event_id = ? AND payment_status = 'paid' AND status != 'cancelled'"
    ).get(params.eventId);
    const paidCount = paidRow?.count || 0;

    if (paidCount > 0) {
      return NextResponse.json(
        { error: `此活動已有 ${paidCount} 筆已繳款報名，無法刪除`, paidCount },
        { status: 409 }
      );
    }

    await db.transaction(async (tx) => {
      // FK chain: registration_items → registrations (CASCADE on registrations); event_items has CASCADE on events.
      await tx.prepare('DELETE FROM registrations WHERE event_id = ?').run(params.eventId);
      await tx.prepare('DELETE FROM events WHERE id = ?').run(params.eventId);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
