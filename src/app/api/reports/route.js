import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';
  const eventId = searchParams.get('eventId');
  const paymentStatus = searchParams.get('payment_status');

  let query = `
    SELECT
      r.id as 報名編號,
      m.name as 姓名,
      m.phone as 電話,
      m.email as Email,
      e.name as 活動名稱,
      r.status as 報名狀態,
      r.total_amount as 金額,
      r.payment_status as 繳款狀態,
      r.receipt_number as 收據號碼,
      r.payment_date as 繳款日期,
      r.payment_notes as 繳款備註,
      r.notes as 報名備註,
      r.created_at as 報名時間
    FROM registrations r
    JOIN members m ON m.id = r.member_id
    JOIN events e ON e.id = r.event_id
    WHERE 1=1
  `;
  const params = [];

  if (eventId) { query += ' AND r.event_id = ?'; params.push(eventId); }
  if (paymentStatus) { query += ' AND r.payment_status = ?'; params.push(paymentStatus); }
  query += ' ORDER BY e.name, m.name';

  const rows = await db.prepare(query).all(...params);

  // Add items detail
  const enriched = [];
  for (const row of rows) {
    const items = await db.prepare(`
      SELECT ei.name as 項目, ri.quantity as 數量, ri.subtotal as 小計, ri.names as 牌位姓名
      FROM registration_items ri
      JOIN event_items ei ON ei.id = ri.event_item_id
      WHERE ri.registration_id = ?
    `).all(row['報名編號']);

    enriched.push({
      ...row,
      報名項目: items.map((i) => `${i['項目']}x${i['數量']}(${i['牌位姓名'] ? JSON.parse(i['牌位姓名']).join(',') : ''})`).join('|'),
    });
  }

  if (format === 'csv') {
    if (enriched.length === 0) {
      return new NextResponse('無資料', {
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }
    const headers = Object.keys(enriched[0]);
    const csvRows = [
      '\uFEFF' + headers.join(','), // BOM for Excel UTF-8
      ...enriched.map((row) =>
        headers.map((h) => {
          const val = String(row[h] ?? '').replace(/"/g, '""');
          return `"${val}"`;
        }).join(',')
      ),
    ];
    return new NextResponse(csvRows.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json(enriched);
});
