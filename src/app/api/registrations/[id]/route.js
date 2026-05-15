import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth, withPermission } from '@/lib/middleware';

export const GET = withPermission('registrations:manage', async (request, { params }) => {
  const reg = await db.prepare(`
    SELECT r.*, m.name as member_name, m.phone as member_phone, m.email as member_email,
           e.name as event_name, e.start_date, e.end_date
    FROM registrations r
    JOIN members m ON m.id = r.member_id
    JOIN events e ON e.id = r.event_id
    WHERE r.id = ?
  `).get(params.id);

  if (!reg) return NextResponse.json({ error: '報名記錄不存在' }, { status: 404 });

  reg.items = await db.prepare(`
    SELECT ri.*, ei.name as item_name, ei.price as item_price
    FROM registration_items ri
    JOIN event_items ei ON ei.id = ri.event_item_id
    WHERE ri.registration_id = ?
  `).all(reg.id);

  return NextResponse.json(reg);
});

export const PUT = withPermission('registrations:manage', async (request, { params }) => {
  const { status, notes } = await request.json();
  await db.prepare(`
    UPDATE registrations SET status=?, notes=?, updated_at=NOW()
    WHERE id=?
  `).run(status, notes || null, params.id);
  return NextResponse.json({ success: true });
});

// Hard-delete a registration (admin). Used when the row is corrupt and we
// want the member to re-register cleanly — soft-cancel doesn't free up the
// UNIQUE(event_id, member_id) slot, so re-registration would be blocked.
//
// Body { wipe: 'all' } also clears the member's 活動登記 (event_attendance)
// for the same event — for the "整筆清乾淨重報" workflow. Default keeps
// 活動登記 untouched (祈福 and 活動登記 are independent sub-modules).
export const DELETE = withPermission('registrations:manage', async (request, { params }) => {
  try {
    let wipeAll = false;
    try {
      const body = await request.json();
      wipeAll = body?.wipe === 'all';
    } catch {
      // empty body is fine
    }

    const reg = await db.prepare('SELECT event_id, member_id FROM registrations WHERE id = ?').get(params.id);
    if (!reg) return NextResponse.json({ error: '報名記錄不存在' }, { status: 404 });

    await db.transaction(async (tx) => {
      await tx.prepare('DELETE FROM registration_items WHERE registration_id = ?').run(params.id);
      await tx.prepare('DELETE FROM registrations WHERE id = ?').run(params.id);
      if (wipeAll) {
        // event_attendance_answers FK cascades on attendance row delete,
        // so we only need to drop the attendance rows themselves.
        await tx.prepare(
          'DELETE FROM event_attendance WHERE event_id = ? AND member_id = ?'
        ).run(reg.event_id, reg.member_id);
      }
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /registrations/[id] failed:', err);
    return NextResponse.json({ error: err.message || '伺服器錯誤' }, { status: 500 });
  }
});

// Member-facing edit: replace items / notes / receipt_title on an unpaid registration.
export const PATCH = withAuth(async (request, { params }) => {
  try {
    const { items, notes, receipt_title } = await request.json();
    const memberId = request.session.sub;

    const reg = await db.prepare('SELECT * FROM registrations WHERE id = ?').get(params.id);
    if (!reg) return NextResponse.json({ error: '報名記錄不存在' }, { status: 404 });
    if (Number(reg.member_id) !== Number(memberId)) {
      return NextResponse.json({ error: '無權限修改此報名' }, { status: 403 });
    }
    if (reg.payment_status === 'paid') {
      return NextResponse.json({ error: '已繳款的報名無法修改' }, { status: 409 });
    }

    const event = await db.prepare("SELECT * FROM events WHERE id = ? AND status = 'active'").get(reg.event_id);
    if (!event) return NextResponse.json({ error: '活動已結束或關閉' }, { status: 400 });
    if (new Date(event.registration_deadline) < new Date()) {
      return NextResponse.json({ error: '報名截止日期已過' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: '請至少選擇一個報名項目' }, { status: 400 });
    }

    const member = await db.prepare('SELECT name, receipt_title FROM members WHERE id = ?').get(memberId);
    const memberDefaultTitle = (member?.receipt_title || member?.name || '').trim();
    const normalizeItemTitle = (v) => {
      const s = v == null ? '' : String(v).trim();
      return (s || memberDefaultTitle).slice(0, 100) || null;
    };

    await db.transaction(async (tx) => {
      let total = 0;
      const resolvedItems = [];
      const giftAllowance = {};
      for (const item of items) {
        if (item.is_gift) continue;
        const eventItem = await tx.prepare('SELECT * FROM event_items WHERE id = ? AND event_id = ?').get(item.eventItemId, reg.event_id);
        if (!eventItem) throw new Error(`項目不存在: ${item.eventItemId}`);
        let subtotal;
        let qty = item.quantity;
        if (eventItem.allow_custom_price) {
          qty = 1;
          const unit = parseInt(item.unit_price);
          if (!Number.isFinite(unit) || unit <= 0) throw new Error(`「${eventItem.name}」金額未填寫`);
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
      for (const item of items) {
        if (!item.is_gift) continue;
        const eventItem = await tx.prepare('SELECT * FROM event_items WHERE id = ? AND event_id = ?').get(item.eventItemId, reg.event_id);
        if (!eventItem) throw new Error(`贈送項目不存在: ${item.eventItemId}`);
        const allowed = giftAllowance[item.eventItemId] || 0;
        if (item.quantity > allowed) {
          throw new Error(`贈送「${eventItem.name}」數量超過上限`);
        }
        giftAllowance[item.eventItemId] = allowed - item.quantity;
        resolvedItems.push({ ...item, subtotal: 0, is_gift: 1, receipt_title: normalizeItemTitle(item.receipt_title) });
      }

      await tx.prepare('DELETE FROM registration_items WHERE registration_id = ?').run(params.id);
      for (const item of resolvedItems) {
        await tx.prepare(`
          INSERT INTO registration_items (registration_id, event_item_id, quantity, names, contents, receipt_title, subtotal, is_gift)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(params.id, item.eventItemId, item.quantity,
               JSON.stringify(item.names || []), JSON.stringify(item.contents || []),
               item.receipt_title, item.subtotal, item.is_gift);
      }

      // Receipt title is now per-item; only touch the legacy registration-level
      // column when the caller explicitly sends it (so admin-set values aren't wiped).
      if (receipt_title !== undefined) {
        const titleVal = receipt_title ? String(receipt_title).trim().slice(0, 100) : null;
        await tx.prepare(`
          UPDATE registrations SET total_amount=?, notes=?, receipt_title=?, updated_at=NOW()
          WHERE id=?
        `).run(total, notes || null, titleVal, params.id);
      } else {
        await tx.prepare(`
          UPDATE registrations SET total_amount=?, notes=?, updated_at=NOW()
          WHERE id=?
        `).run(total, notes || null, params.id);
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /registrations/[id] failed:', err);
    return NextResponse.json({ error: err.message || '伺服器錯誤' }, { status: 500 });
  }
});
