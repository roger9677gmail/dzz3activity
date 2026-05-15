import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const PUT = withPermission('registrations:manage', async (request, { params }) => {
  try {
    const body = await request.json();
    const { payment_status, payment_date, payment_notes } = body;

    let regReceiptNumber = null;
    let regReceiptTitle = null;

    if (Array.isArray(body.receipts)) {
      // New format: one receipt_number per unique receipt_title.
      // Build a title → receipt_number map (trimmed, length-capped).
      const titleToNumber = new Map();
      for (const r of body.receipts) {
        if (!r) continue;
        const t = (r.title || '').toString().trim();
        if (!t) continue;
        const n = (r.receipt_number || '').toString().trim();
        titleToNumber.set(t, n ? n.slice(0, 50) : null);
      }
      // Legacy registration-level columns get the first non-empty entry so
      // existing list views and search-by-receipt-number still work.
      const first = body.receipts.find((r) => r && (r.receipt_number || '').toString().trim());
      if (first) {
        regReceiptNumber = String(first.receipt_number).trim().slice(0, 50);
        regReceiptTitle = first.title ? String(first.title).trim().slice(0, 100) : null;
      }

      // Compute the fallback title used when an item has no per-item title.
      const reg = await db.prepare(`
        SELECT r.receipt_title,
               COALESCE(NULLIF(m.receipt_title, ''), m.name) AS member_default_title
          FROM registrations r
          JOIN members m ON m.id = r.member_id
         WHERE r.id = ?
      `).get(params.id);
      if (!reg) return NextResponse.json({ error: '報名記錄不存在' }, { status: 404 });
      const fallbackTitle = ((reg.receipt_title || '').trim()) || (reg.member_default_title || '').trim();

      const items = await db.prepare(
        'SELECT id, receipt_title FROM registration_items WHERE registration_id = ?'
      ).all(params.id);
      for (const item of items) {
        const effective = ((item.receipt_title || '').trim()) || fallbackTitle;
        const number = titleToNumber.has(effective) ? titleToNumber.get(effective) : null;
        await db.prepare('UPDATE registration_items SET receipt_number=? WHERE id=?').run(number, item.id);
      }
    } else {
      // Legacy single-receipt format - apply same number to every item.
      const receipt_number = body.receipt_number;
      const receipt_title = body.receipt_title;
      regReceiptNumber = receipt_number ? String(receipt_number).trim().slice(0, 50) : null;
      regReceiptTitle = receipt_title ? String(receipt_title).trim().slice(0, 100) : null;
      await db.prepare(
        'UPDATE registration_items SET receipt_number=? WHERE registration_id=?'
      ).run(regReceiptNumber, params.id);
    }

    await db.prepare(`
      UPDATE registrations
      SET payment_status=?, receipt_number=?, receipt_title=?, payment_date=?, payment_notes=?,
          status=CASE WHEN ? = 'paid' THEN 'confirmed' ELSE status END,
          updated_at=NOW()
      WHERE id=?
    `).run(payment_status, regReceiptNumber, regReceiptTitle, payment_date || null, payment_notes || null, payment_status, params.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
