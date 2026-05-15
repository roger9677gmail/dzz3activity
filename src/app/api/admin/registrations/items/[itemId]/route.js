import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

// Admin-only edit of a single registration_item.quantity (for fixing legacy
// rows that were saved with wrong counts). Recomputes the item's subtotal
// and the parent registration's total_amount. Gift rows and allow_custom_price
// items are blocked because their quantity has cross-row meaning that can't be
// fixed in isolation.
export const PATCH = withPermission('registrations:manage', async (request, { params }) => {
  try {
    const { quantity } = await request.json();
    const qty = parseInt(quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      return NextResponse.json({ error: '數量必須 ≥ 1' }, { status: 400 });
    }

    const item = await db.prepare(`
      SELECT ri.*, ei.price, ei.allow_custom_price, ei.name AS item_name
        FROM registration_items ri
        JOIN event_items ei ON ei.id = ri.event_item_id
       WHERE ri.id = ?
    `).get(params.itemId);

    if (!item) return NextResponse.json({ error: '項目不存在' }, { status: 404 });
    if (item.is_gift) {
      return NextResponse.json({ error: '贈品數量由 parent 自動計算，無法直接修改' }, { status: 400 });
    }
    if (item.allow_custom_price) {
      return NextResponse.json({ error: '隨喜功德項目每筆一行，請從會員端編輯報名' }, { status: 400 });
    }

    const newSubtotal = (item.price || 0) * qty;

    await db.transaction(async (tx) => {
      await tx.prepare(`
        UPDATE registration_items SET quantity=?, subtotal=? WHERE id=?
      `).run(qty, newSubtotal, params.itemId);

      // Recompute registration total from all remaining items.
      const totalRow = await tx.prepare(`
        SELECT COALESCE(SUM(subtotal), 0) AS total
          FROM registration_items
         WHERE registration_id = ?
      `).get(item.registration_id);
      await tx.prepare(`
        UPDATE registrations SET total_amount=?, updated_at=NOW() WHERE id=?
      `).run(totalRow.total || 0, item.registration_id);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /admin/registrations/items/[itemId] failed:', err);
    return NextResponse.json({ error: err.message || '伺服器錯誤' }, { status: 500 });
  }
});
