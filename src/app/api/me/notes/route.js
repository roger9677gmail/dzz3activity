import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CONTENT = 5000;
const MAX_IMAGE = 1_400_000; // ~1.4 MB data URL after client-side resize
const URL_RE = /^https?:\/\/\S+$/i;

function validateImage(raw) {
  if (raw == null || raw === '') return { ok: true, value: null };
  const v = String(raw);
  if (!v.startsWith('data:image/')) return { ok: false, error: '圖片格式不正確' };
  if (v.length > MAX_IMAGE) return { ok: false, error: '圖片太大，請壓縮後再上傳' };
  return { ok: true, value: v };
}
function validateUrl(raw) {
  if (raw == null || raw === '') return { ok: true, value: null };
  const v = String(raw).trim();
  if (!URL_RE.test(v)) return { ok: false, error: '連結需以 http:// 或 https:// 開頭' };
  if (v.length > 500) return { ok: false, error: '連結過長' };
  return { ok: true, value: v };
}

// GET list of my notes.
//   ?date=YYYY-MM-DD  → all notes for that day (no pagination)
//   ?offset=N         → paginated: 20 newest per page, with `hasMore` flag
export const GET = withAuth(async (request) => {
  const memberId = request.session.sub;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (date) {
    if (!DATE_RE.test(date)) return NextResponse.json({ error: '日期格式應為 YYYY-MM-DD' }, { status: 400 });
    const rows = await db
      .prepare(
        `SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') AS log_date, content, image, link_url, is_public, created_at, updated_at
           FROM practice_notes
          WHERE member_id = ? AND log_date = ?
          ORDER BY created_at DESC`
      )
      .all(memberId, date);
    return NextResponse.json({ notes: rows });
  }

  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
  const limit = 20;
  const rows = await db
    .prepare(
      `SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') AS log_date, content, image, link_url, is_public, created_at, updated_at
         FROM practice_notes
        WHERE member_id = ?
        ORDER BY log_date DESC, id DESC
        LIMIT ${limit + 1} OFFSET ${offset}`
    )
    .all(memberId);
  const hasMore = rows.length > limit;
  const notes = hasMore ? rows.slice(0, limit) : rows;
  return NextResponse.json({ notes, hasMore });
});

export const POST = withAuth(async (request) => {
  const memberId = request.session.sub;
  try {
    const body = await request.json();
    const { log_date, content, is_public } = body;
    if (!log_date || !DATE_RE.test(log_date)) {
      return NextResponse.json({ error: '日期格式應為 YYYY-MM-DD' }, { status: 400 });
    }
    const text = String(content || '').trim();
    if (!text) return NextResponse.json({ error: '請輸入筆記內容' }, { status: 400 });
    if (text.length > MAX_CONTENT) {
      return NextResponse.json({ error: `筆記過長（上限 ${MAX_CONTENT} 字）` }, { status: 400 });
    }
    const img = validateImage(body.image);
    if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });
    const link = validateUrl(body.link_url);
    if (!link.ok) return NextResponse.json({ error: link.error }, { status: 400 });

    const r = await db
      .prepare(
        'INSERT INTO practice_notes (member_id, log_date, content, image, link_url, is_public) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(memberId, log_date, text, img.value, link.value, is_public ? 1 : 0);
    return NextResponse.json({ success: true, id: r.lastInsertRowid });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
