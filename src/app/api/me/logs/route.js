import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET single day or a range:
//   /api/me/logs?date=YYYY-MM-DD            → list of {practice_id, value} for that day
//   /api/me/logs?from=YYYY-MM-DD&to=...     → list of {practice_id, log_date, value} for charting
export const GET = withAuth(async (request) => {
  const memberId = request.session.sub;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (date) {
    if (!DATE_RE.test(date)) return NextResponse.json({ error: '日期格式應為 YYYY-MM-DD' }, { status: 400 });
    const rows = await db
      .prepare('SELECT practice_id, value FROM practice_logs WHERE member_id = ? AND log_date = ?')
      .all(memberId, date);
    return NextResponse.json({ logs: rows });
  }

  if (from || to) {
    if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
      return NextResponse.json({ error: 'from/to 格式應為 YYYY-MM-DD' }, { status: 400 });
    }
    const rows = await db
      .prepare(
        `SELECT practice_id, DATE_FORMAT(log_date, '%Y-%m-%d') AS log_date, value
           FROM practice_logs
          WHERE member_id = ? AND log_date BETWEEN ? AND ?
          ORDER BY log_date`
      )
      .all(memberId, from, to);
    return NextResponse.json({ logs: rows });
  }

  return NextResponse.json({ error: '需指定 date 或 from/to' }, { status: 400 });
});

// PUT body: { date: 'YYYY-MM-DD', entries: [{ practice_id, value }] }
//   value = 0 or null deletes the row for that practice/date.
export const PUT = withAuth(async (request) => {
  const memberId = request.session.sub;
  try {
    const { date, entries } = await request.json();
    if (!date || !DATE_RE.test(date)) return NextResponse.json({ error: '日期格式應為 YYYY-MM-DD' }, { status: 400 });
    if (!Array.isArray(entries)) return NextResponse.json({ error: 'entries 必須為陣列' }, { status: 400 });

    for (const entry of entries) {
      const practiceId = parseInt(entry?.practice_id);
      if (!Number.isInteger(practiceId) || practiceId <= 0) continue;
      const raw = entry.value;
      const value = raw == null || raw === '' ? 0 : Math.max(0, parseInt(raw) || 0);
      if (value === 0) {
        await db
          .prepare('DELETE FROM practice_logs WHERE member_id = ? AND practice_id = ? AND log_date = ?')
          .run(memberId, practiceId, date);
      } else {
        await db
          .prepare(
            `INSERT INTO practice_logs (member_id, practice_id, log_date, value)
               VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE value = VALUES(value)`
          )
          .run(memberId, practiceId, date, value);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
