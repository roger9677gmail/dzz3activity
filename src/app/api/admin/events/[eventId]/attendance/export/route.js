import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { parseOptions, formatAnswer } from '@/lib/attendance';

export const dynamic = 'force-dynamic';

export const GET = withPermission('attendance:manage', async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });
  const event = await db.prepare('SELECT id, name FROM events WHERE id = ?').get(eventId);
  if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

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
      `SELECT a.id, a.member_id, a.attendee_name, a.attendee_relation, a.notes, a.created_at,
              m.name AS member_name, m.phone AS member_phone,
              l.name AS location_name
         FROM event_attendance a
         JOIN members m ON m.id = a.member_id
    LEFT JOIN locations l ON l.id = m.location_id
        WHERE a.event_id = ? AND m.is_disabled = 0
        ORDER BY m.name, (a.attendee_name IS NOT NULL), a.id`
    )
    .all(eventId);

  // Pre-fetch answers grouped by attendance.id
  const answers = {};
  for (const r of rows) {
    const ans = await db
      .prepare('SELECT question_id, value FROM event_attendance_answers WHERE attendance_id = ?')
      .all(r.id);
    const map = {};
    for (const a of ans) {
      let v = a.value;
      if (typeof v === 'string') {
        try { v = JSON.parse(v); } catch {}
      }
      map[a.question_id] = v;
    }
    answers[r.id] = map;
  }

  // Build column layout. multi_date types fan out into one column per date.
  const columns = [
    { header: '序號', key: '_idx', width: 6 },
    { header: '師兄姐', key: '_name', width: 14 },
    { header: '登記對象', key: '_attendee', width: 14 },
    { header: '關係', key: '_relation', width: 10 },
    { header: '道場', key: '_location', width: 14 },
    { header: '電話', key: '_phone', width: 14 },
  ];
  const colSpec = []; // [{question, dateKey?}]
  for (const q of questions) {
    if (q.type === 'multi_date' && Array.isArray(q.options.dates)) {
      for (const d of q.options.dates) {
        const key = `q${q.id}_${d}`;
        // For YYYY-MM-DD strip year prefix to keep header tight; otherwise show full text.
        const short = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(5) : d;
        columns.push({ header: `${q.label} ${short}`, key, width: 10 });
        colSpec.push({ question: q, dateKey: d, key });
      }
    } else {
      const key = `q${q.id}`;
      columns.push({ header: q.label, key, width: 18 });
      colSpec.push({ question: q, key });
    }
  }
  columns.push({ header: '備註', key: '_notes', width: 20 });
  columns.push({ header: '提交時間', key: '_at', width: 18 });

  const wb = new ExcelJS.Workbook();
  wb.creator = '大自在山活動報名系統';
  wb.created = new Date();
  const ws = wb.addWorksheet('活動登記', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  rows.forEach((r, idx) => {
    const out = {
      _idx: idx + 1,
      _name: r.member_name,
      _attendee: r.attendee_name || '本人',
      _relation: r.attendee_relation || '',
      _location: r.location_name || '',
      _phone: r.member_phone || '',
      _notes: r.notes || '',
      _at: r.created_at,
    };
    const ansMap = answers[r.id] || {};
    for (const spec of colSpec) {
      const v = ansMap[spec.question.id];
      if (spec.dateKey) {
        // Cell is 1 if member ticked this date, else blank
        const dates = v && Array.isArray(v.dates) ? v.dates : [];
        out[spec.key] = dates.includes(spec.dateKey) ? 1 : '';
      } else {
        out[spec.key] = formatAnswer(spec.question, v);
      }
    }
    ws.addRow(out);
  });

  const buf = await wb.xlsx.writeBuffer();
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  // ASCII fallback for legacy HTTP header parsers; modern browsers prefer
  // filename* with RFC 5987 percent-encoding for the real (Chinese) name.
  const asciiFilename = `attendance-${eventId}-${ts}.xlsx`;
  const prettyName = `${String(event.name).replace(/[\\/:*?"<>|]/g, '_')}-活動登記-${ts}.xlsx`;
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(prettyName)}`,
    },
  });
});
