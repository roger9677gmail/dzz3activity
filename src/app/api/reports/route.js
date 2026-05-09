import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const dynamic = 'force-dynamic';

const HEADERS = [
  '報名日期',
  '功德主(陽上)',
  '超度內容',
  '金額',
  '項目',
  '收據編號',
  '收據抬頭',
  '連絡人',
  '電話',
  '地址',
  '道場',
];

function safeParse(val) {
  if (!val) return [];
  try {
    const v = JSON.parse(val);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function fmtDate(d) {
  if (!d) return '';
  const s = (d instanceof Date) ? d.toISOString() : String(d);
  return s.slice(0, 10);
}

async function loadRows({ eventId, paymentStatus, status }) {
  let query = `
    SELECT r.id, r.event_id, r.created_at, r.payment_status, r.status,
           r.receipt_number, r.notes,
           m.name AS member_name, m.phone AS member_phone, m.address AS member_address,
           COALESCE(NULLIF(m.receipt_title, ''), m.name) AS member_receipt_title,
           l.name AS location_name,
           e.name AS event_name
    FROM registrations r
    JOIN members m ON m.id = r.member_id
    JOIN events e ON e.id = r.event_id
    LEFT JOIN locations l ON l.id = m.location_id
    WHERE 1=1
  `;
  const params = [];
  if (eventId) { query += ' AND r.event_id = ?'; params.push(eventId); }
  if (paymentStatus) { query += ' AND r.payment_status = ?'; params.push(paymentStatus); }
  if (status) { query += ' AND r.status = ?'; params.push(status); }
  query += ' ORDER BY e.name, r.created_at, m.name, r.id';

  const regs = await db.prepare(query).all(...params);

  const out = [];
  for (const r of regs) {
    const items = await db.prepare(`
      SELECT ri.quantity, ri.names, ri.contents, ri.subtotal, ri.is_gift, ei.name AS item_name
      FROM registration_items ri
      JOIN event_items ei ON ei.id = ri.event_item_id
      WHERE ri.registration_id = ?
      ORDER BY ri.is_gift, ri.id
    `).all(r.id);

    let giftCounter = 0;
    for (const it of items) {
      const namesArr = safeParse(it.names);
      const contentsArr = safeParse(it.contents);
      const qty = it.quantity || 1;
      const unit = qty > 0 ? Math.round((it.subtotal || 0) / qty) : (it.subtotal || 0);
      for (let i = 0; i < qty; i++) {
        const isGift = !!it.is_gift;
        if (isGift) giftCounter += 1;
        out.push({
          報名日期: fmtDate(r.created_at),
          '功德主(陽上)': namesArr[i] || '',
          超度內容: contentsArr[i] || '',
          金額: isGift ? `贈${giftCounter}` : unit,
          項目: it.item_name,
          收據編號: r.receipt_number || '',
          收據抬頭: r.member_receipt_title,
          連絡人: r.member_name,
          電話: r.member_phone || '',
          地址: r.member_address || '',
          道場: r.location_name || '',
        });
      }
    }
  }
  return out;
}

async function buildXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '大自在山活動報名系統';
  wb.created = new Date();

  const ws = wb.addWorksheet('報名明細', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { header: HEADERS[0], key: '報名日期', width: 12 },
    { header: HEADERS[1], key: '功德主(陽上)', width: 18 },
    { header: HEADERS[2], key: '超度內容', width: 30 },
    { header: HEADERS[3], key: '金額', width: 10 },
    { header: HEADERS[4], key: '項目', width: 12 },
    { header: HEADERS[5], key: '收據編號', width: 20 },
    { header: HEADERS[6], key: '收據抬頭', width: 18 },
    { header: HEADERS[7], key: '連絡人', width: 12 },
    { header: HEADERS[8], key: '電話', width: 14 },
    { header: HEADERS[9], key: '地址', width: 30 },
    { header: HEADERS[10], key: '道場', width: 18 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  for (const r of rows) ws.addRow(r);

  ws.getColumn('金額').alignment = { horizontal: 'right' };
  ws.getColumn('金額').numFmt = '#,##0';

  return await wb.xlsx.writeBuffer();
}

export const GET = withPermission('reports:view', async (request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const paymentStatus = searchParams.get('payment_status');
  const status = searchParams.get('status');

  const rows = await loadRows({ eventId, paymentStatus, status });
  const buf = await buildXlsx(rows);
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="report-${ts}.xlsx"`,
    },
  });
});
