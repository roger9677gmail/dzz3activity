import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CONTENT = 5000;

// GET list of my notes (newest first), optional ?date=YYYY-MM-DD filter.
export const GET = withAuth(async (request) => {
  const memberId = request.session.sub;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  let rows;
  if (date) {
    if (!DATE_RE.test(date)) return NextResponse.json({ error: '日期格式應為 YYYY-MM-DD' }, { status: 400 });
    rows = await db
      .prepare(
        `SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') AS log_date, content, is_public, created_at, updated_at
           FROM practice_notes
          WHERE member_id = ? AND log_date = ?
          ORDER BY created_at DESC`
      )
      .all(memberId, date);
  } else {
    rows = await db
      .prepare(
        `SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') AS log_date, content, is_public, created_at, updated_at
           FROM practice_notes
          WHERE member_id = ?
          ORDER BY log_date DESC, created_at DESC
          LIMIT 200`
      )
      .all(memberId);
  }
  return NextResponse.json({ notes: rows });
});

export const POST = withAuth(async (request) => {
  const memberId = request.session.sub;
  try {
    const { log_date, content, is_public } = await request.json();
    if (!log_date || !DATE_RE.test(log_date)) {
      return NextResponse.json({ error: '日期格式應為 YYYY-MM-DD' }, { status: 400 });
    }
    const text = String(content || '').trim();
    if (!text) return NextResponse.json({ error: '請輸入筆記內容' }, { status: 400 });
    if (text.length > MAX_CONTENT) {
      return NextResponse.json({ error: `筆記過長（上限 ${MAX_CONTENT} 字）` }, { status: 400 });
    }
    const r = await db
      .prepare('INSERT INTO practice_notes (member_id, log_date, content, is_public) VALUES (?, ?, ?, ?)')
      .run(memberId, log_date, text, is_public ? 1 : 0);
    return NextResponse.json({ success: true, id: r.lastInsertRowid });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
