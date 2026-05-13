import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { isStaffOrAdmin } from '@/lib/staff-access';
import { parseOptions, formatAnswer } from '@/lib/attendance';
import { safeParseJSON } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ?type=qf | attendance
export const GET = withAuth(async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

  if (!(await isStaffOrAdmin(request.session, eventId))) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const event = await db.prepare('SELECT id, name FROM events WHERE id = ?').get(eventId);
  if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') === 'attendance' ? 'attendance' : 'qf';

  const wb = new ExcelJS.Workbook();
  wb.creator = '大自在山活動報名系統';
  wb.created = new Date();

  if (type === 'qf') {
    await buildQfSheet(wb, eventId);
  } else {
    await buildAttendanceSheet(wb, eventId);
  }

  const buf = await wb.xlsx.writeBuffer();
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const safeName = String(event.name).replace(/[\\/:*?"<>|]/g, '_');
  const pretty = `${safeName}-${type === 'qf' ? '祈福報名' : '活動報名'}-${ts}.xlsx`;
  const ascii = `event-${eventId}-${type}-${ts}.xlsx`;
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(pretty)}`,
    },
  });
});

async function buildQfSheet(wb, eventId) {
  // Staff scope: 不露金額、收據編號；露姓名、電話、地址、項目、功德主、超度內容、繳款狀態
  const regs = await db
    .prepare(
      `SELECT r.id, r.payment_status, r.created_at,
              m.name AS member_name, m.phone AS member_phone, m.address AS member_address,
              l.name AS location_name
         FROM registrations r
         JOIN members m ON m.id = r.member_id
    LEFT JOIN locations l ON l.id = m.location_id
        WHERE r.event_id = ? AND r.status != 'cancelled' AND m.is_disabled = 0
        ORDER BY m.name, r.id`
    )
    .all(eventId);

  const itemsByReg = new Map();
  if (regs.length > 0) {
    const ids = regs.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const items = await db
      .prepare(
        `SELECT ri.registration_id, ri.quantity, ri.names, ri.contents, ri.is_gift,
                ei.name AS item_name
           FROM registration_items ri
           JOIN event_items ei ON ei.id = ri.event_item_id
          WHERE ri.registration_id IN (${placeholders})
          ORDER BY ri.registration_id, ri.is_gift, ri.id`
      )
      .all(...ids);
    for (const it of items) {
      if (!itemsByReg.has(it.registration_id)) itemsByReg.set(it.registration_id, []);
      itemsByReg.get(it.registration_id).push(it);
    }
  }

  const ws = wb.addWorksheet('祈福報名', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: '功德主(陽上)', key: 'name', width: 18 },
    { header: '超度內容', key: 'content', width: 30 },
    { header: '項目', key: 'item', width: 14 },
    { header: '報名人', key: 'member', width: 14 },
    { header: '電話', key: 'phone', width: 14 },
    { header: '道場', key: 'location', width: 14 },
    { header: '地址', key: 'address', width: 28 },
    { header: '繳款狀態', key: 'paid', width: 10 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of regs) {
    const items = itemsByReg.get(r.id) || [];
    for (const it of items) {
      const names = safeParseJSON(it.names);
      const contents = safeParseJSON(it.contents);
      const qty = it.quantity || 1;
      for (let i = 0; i < qty; i++) {
        ws.addRow({
          name: names[i] || '',
          content: contents[i] || '',
          item: it.is_gift ? `${it.item_name}（贈品）` : it.item_name,
          member: r.member_name,
          phone: r.member_phone || '',
          location: r.location_name || '',
          address: r.member_address || '',
          paid: r.payment_status === 'paid' ? '已繳款' : '未繳款',
        });
      }
    }
  }
}

async function buildAttendanceSheet(wb, eventId) {
  const questions = (await db
    .prepare(
      `SELECT id, label, type, options
         FROM event_attendance_questions
        WHERE event_id = ?
        ORDER BY sort_order, id`
    )
    .all(eventId))
    .map((q) => ({ ...q, options: parseOptions(q.type, q.options) }));

  const rows = await db
    .prepare(
      `SELECT a.id, a.attendee_name, a.attendee_relation, a.notes, a.created_at,
              m.name AS member_name, m.phone AS member_phone,
              l.name AS location_name
         FROM event_attendance a
         JOIN members m ON m.id = a.member_id
    LEFT JOIN locations l ON l.id = m.location_id
        WHERE a.event_id = ? AND m.is_disabled = 0
        ORDER BY m.name, (a.attendee_name IS NOT NULL), a.id`
    )
    .all(eventId);

  const answers = {};
  for (const r of rows) answers[r.id] = {};
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const allAns = await db
      .prepare(
        `SELECT attendance_id, question_id, value
           FROM event_attendance_answers
          WHERE attendance_id IN (${placeholders})`
      )
      .all(...ids);
    for (const a of allAns) {
      if (!answers[a.attendance_id]) continue;
      answers[a.attendance_id][a.question_id] = safeParseJSON(a.value, {});
    }
  }

  const ws = wb.addWorksheet('活動報名', { views: [{ state: 'frozen', ySplit: 1 }] });
  const columns = [
    { header: '序號', key: '_idx', width: 6 },
    { header: '師兄姐', key: 'member', width: 14 },
    { header: '登記對象', key: 'attendee', width: 14 },
    { header: '關係', key: 'relation', width: 10 },
    { header: '道場', key: 'location', width: 14 },
    { header: '電話', key: 'phone', width: 14 },
  ];
  for (const q of questions) columns.push({ header: q.label, key: `q${q.id}`, width: 18 });
  columns.push({ header: '備註', key: 'notes', width: 20 });
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };

  rows.forEach((r, idx) => {
    const out = {
      _idx: idx + 1,
      member: r.member_name,
      attendee: r.attendee_name || '本人',
      relation: r.attendee_relation || '',
      location: r.location_name || '',
      phone: r.member_phone || '',
      notes: r.notes || '',
    };
    for (const q of questions) {
      out[`q${q.id}`] = formatAnswer(q, answers[r.id]?.[q.id]);
    }
    ws.addRow(out);
  });
}
