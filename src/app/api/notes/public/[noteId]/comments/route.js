import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

const MAX_COMMENT = 500;

async function loadPublicNote(noteId) {
  const note = await db
    .prepare('SELECT id, is_public FROM practice_notes WHERE id = ?')
    .get(noteId);
  if (!note) return { error: '筆記不存在', status: 404 };
  if (!note.is_public) return { error: '此筆記未公開', status: 403 };
  return { note };
}

export const GET = withAuth(async (request, { params }) => {
  const noteId = parseInt(params.noteId);
  if (!noteId) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  const owned = await loadPublicNote(noteId);
  if (owned.error) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const memberId = Number(request.session.sub);
  const comments = await db
    .prepare(
      `SELECT c.id, c.content, c.created_at, c.member_id,
              m.name AS member_name, m.avatar AS member_avatar
         FROM practice_note_comments c
         JOIN members m ON m.id = c.member_id
        WHERE c.note_id = ?
        ORDER BY c.id ASC`
    )
    .all(noteId);
  // Flag comments the caller is allowed to delete (their own).
  for (const c of comments) c.can_delete = Number(c.member_id) === memberId;
  return NextResponse.json({ comments });
});

export const POST = withAuth(async (request, { params }) => {
  try {
    const memberId = request.session.sub;
    const noteId = parseInt(params.noteId);
    if (!noteId) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    const owned = await loadPublicNote(noteId);
    if (owned.error) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const body = await request.json();
    const text = String(body.content || '').trim();
    if (!text) return NextResponse.json({ error: '請輸入留言內容' }, { status: 400 });
    if (text.length > MAX_COMMENT) {
      return NextResponse.json({ error: `留言過長（上限 ${MAX_COMMENT} 字）` }, { status: 400 });
    }
    const r = await db
      .prepare('INSERT INTO practice_note_comments (note_id, member_id, content) VALUES (?, ?, ?)')
      .run(noteId, memberId, text);
    return NextResponse.json({ success: true, id: r.lastInsertRowid });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
