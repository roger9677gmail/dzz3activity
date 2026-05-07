import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth, withAdminAuth } from '@/lib/middleware';

export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const paymentStatus = searchParams.get('payment_status');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = `
    SELECT r.*, m.name as member_name, m.phone as member_phone,
           e.name as event_name
    FROM registrations r
    JOIN members m ON m.id = r.member_id
    JOIN events e ON e.id = r.event_id
    WHERE 1=1
  `;
  const params = [];

  if (eventId) { query += ' AND r.event_id = ?'; params.push(eventId); }
  if (paymentStatus) { query += ' AND r.payment_status = ?'; params.push(paymentStatus); }
  if (status) { query += ' AND r.status = ?'; params.push(status); }
  if (search) {
    query += ' AND (m.name LIKE ? OR m.phone LIKE ? OR r.receipt_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const totalRow = await db.prepare(query.replace('SELECT r.*, m.name as member_name, m.phone as member_phone,\n           e.name as event_name', 'SELECT COUNT(*) AS total')).get(...params);
  query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const registrations = await db.prepare(query).all(...params);
  for (const reg of registrations) {
    reg.items = await db.prepare(`
      SELECT ri.*, ei.name as item_name
      FROM registration_items ri
      JOIN event_items ei ON ei.id = ri.event_item_id
      WHERE ri.registration_id = ?
    `).all(reg.id);
  }

  return NextResponse.json({ registrations, total: totalRow?.total || 0, page, limit });
});

export const POST = withAuth(async (request) => {
  try {
    const { eventId, items, notes } = await request.json();

    const event = await db.prepare("SELECT * FROM events WHERE id = ? AND status = 'active'").get(eventId);
    if (!event) return NextResponse.json({ error: '活動不存在或已截止報名' }, { status: 400 });
    if (new Date(event.registration_deadline) < new Date()) {
      return NextResponse.json({ error: '報名截止日期已過' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: '請至少選擇一個報名項目' }, { status: 400 });
    }

    const memberId = request.session.sub;
    const regId = await db.transaction(async (tx) => {
      let total = 0;
      const resolvedItems = [];
      for (const item of items) {
        const eventItem = await tx.prepare('SELECT * FROM event_items WHERE id = ? AND event_id = ?').get(item.eventItemId, eventId);
        if (!eventItem) throw new Error(`項目不存在: ${item.eventItemId}`);
        const subtotal = eventItem.price * item.quantity;
        total += subtotal;
        resolvedItems.push({ ...item, subtotal });
      }

      const reg = await tx.prepare(`
        INSERT INTO registrations (event_id, member_id, total_amount, notes)
        VALUES (?, ?, ?, ?)
      `).run(eventId, memberId, total, notes || null);

      const newRegId = reg.lastInsertRowid;
      for (const item of resolvedItems) {
        await tx.prepare(`
          INSERT INTO registration_items (registration_id, event_item_id, quantity, names, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `).run(newRegId, item.eventItemId, item.quantity, JSON.stringify(item.names || []), item.subtotal);
      }
      return newRegId;
    });

    return NextResponse.json({ success: true, registrationId: regId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || (err.message && err.message.includes('Duplicate entry'))) {
      return NextResponse.json({ error: '您已報名此活動' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: err.message || '伺服器錯誤' }, { status: 500 });
  }
});
