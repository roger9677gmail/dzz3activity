import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export const PUT = withAdminAuth(async (request, { params }) => {
  try {
    const { payment_status, receipt_number, payment_date, payment_notes } = await request.json();

    await db.prepare(`
      UPDATE registrations
      SET payment_status=?, receipt_number=?, payment_date=?, payment_notes=?,
          status=CASE WHEN ? = 'paid' THEN 'confirmed' ELSE status END,
          updated_at=NOW()
      WHERE id=?
    `).run(payment_status, receipt_number || null, payment_date || null, payment_notes || null, payment_status, params.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
