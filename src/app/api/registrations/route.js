import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth, withPermission } from '@/lib/middleware';

export const GET = withPermission('registrations:manage', async (request) => {
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
    const { eventId, items, notes, receipt_title } = await request.json();

    const event = await db.prepare("SELECT * FROM events WHERE id = ? AND status = 'active'").get(eventId);
    if (!event) return NextResponse.json({ error: '活動不存在或已截止報名' }, { status: 400 });
    if (new Date(event.registration_deadline) < new Date()) {
      return NextResponse.json({ error: '報名截止日期已過' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: '請至少選擇一個報名項目' }, { status: 400 });
    }

    const memberId = request.session.sub;
    const member = await db.prepare('SELECT name, receipt_title FROM members WHERE id = ?').get(memberId);
    const memberDefaultTitle = (member?.receipt_title || member?.name || '').trim();
    const normalizeItemTitle = (v) => {
      const s = v == null ? '' : String(v).trim();
      return (s || memberDefaultTitle).slice(0, 100) || null;
    };
    const regId = await db.transaction(async (tx) => {
      let total = 0;
      const resolvedItems = [];
      // First pass: regular items. Track gift quota earned per gift_event_item_id.
      const giftAllowance = {};
      for (const item of items) {
        if (item.is_gift) continue;
        const eventItem = await tx.prepare('SELECT * FROM event_items WHERE id = ? AND event_id = ?').get(item.eventItemId, eventId);
        if (!eventItem) throw new Error(`項目不存在: ${item.eventItemId}`);
        let subtotal;
        let qty = item.quantity;
        if (eventItem.allow_custom_price) {
          // Custom (隨喜) item: trust unit_price after server-side min check, force qty=1.
          qty = 1;
          const unit = parseInt(item.unit_price);
          if (!Number.isFinite(unit) || unit <= 0) {
            throw new Error(`「${eventItem.name}」金額未填寫`);
          }
          if (eventItem.price > 0 && unit < eventItem.price) {
            throw new Error(`「${eventItem.name}」最低金額為 ${eventItem.price} 元`);
          }
          subtotal = unit;
        } else {
          subtotal = eventItem.price * item.quantity;
        }
        total += subtotal;
        resolvedItems.push({ ...item, quantity: qty, subtotal, is_gift: 0, receipt_title: normalizeItemTitle(item.receipt_title) });
        if (eventItem.gift_event_item_id && eventItem.gift_quantity > 0) {
          giftAllowance[eventItem.gift_event_item_id] =
            (giftAllowance[eventItem.gift_event_item_id] || 0) + qty * eventItem.gift_quantity;
        }
      }
      // Second pass: gift items. Verify quota; subtotal forced to 0.
      for (const item of items) {
        if (!item.is_gift) continue;
        const eventItem = await tx.prepare('SELECT * FROM event_items WHERE id = ? AND event_id = ?').get(item.eventItemId, eventId);
        if (!eventItem) throw new Error(`贈送項目不存在: ${item.eventItemId}`);
        const allowed = giftAllowance[item.eventItemId] || 0;
        if (item.quantity > allowed) {
          throw new Error(`贈送「${eventItem.name}」數量超過上限`);
        }
        giftAllowance[item.eventItemId] = allowed - item.quantity;
        resolvedItems.push({ ...item, subtotal: 0, is_gift: 1, receipt_title: normalizeItemTitle(item.receipt_title) });
      }

      const titleVal = receipt_title ? String(receipt_title).trim().slice(0, 100) : null;
      const reg = await tx.prepare(`
        INSERT INTO registrations (event_id, member_id, total_amount, notes, receipt_title)
        VALUES (?, ?, ?, ?, ?)
      `).run(eventId, memberId, total, notes || null, titleVal);

      const newRegId = reg.lastInsertRowid;
      for (const item of resolvedItems) {
        await tx.prepare(`
          INSERT INTO registration_items (registration_id, event_item_id, quantity, names, contents, receipt_title, subtotal, is_gift)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(newRegId, item.eventItemId, item.quantity,
               JSON.stringify(item.names || []), JSON.stringify(item.contents || []),
               item.receipt_title, item.subtotal, item.is_gift);
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
