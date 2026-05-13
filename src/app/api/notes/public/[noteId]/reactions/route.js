import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

const ALLOWED = ['🙏', '👍', '❤️', '😊', '🎉'];

async function loadPublicNoteOrError(noteId) {
  const note = await db
    .prepare('SELECT id, is_public FROM practice_notes WHERE id = ?')
    .get(noteId);
  if (!note) return { error: '筆記不存在', status: 404 };
  if (!note.is_public) return { error: '此筆記未公開', status: 403 };
  return { note };
}

// POST { emoji } — toggle. Returns the new state for this emoji.
export const POST = withAuth(async (request, { params }) => {
  try {
    const memberId = request.session.sub;
    const noteId = parseInt(params.noteId);
    if (!noteId) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    const owned = await loadPublicNoteOrError(noteId);
    if (owned.error) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const { emoji } = await request.json();
    const e = String(emoji || '').trim();
    if (!ALLOWED.includes(e)) {
      return NextResponse.json({ error: '不支援的表情' }, { status: 400 });
    }

    const existing = await db
      .prepare('SELECT 1 FROM practice_note_reactions WHERE note_id = ? AND member_id = ? AND emoji = ?')
      .get(noteId, memberId, e);
    if (existing) {
      await db
        .prepare('DELETE FROM practice_note_reactions WHERE note_id = ? AND member_id = ? AND emoji = ?')
        .run(noteId, memberId, e);
    } else {
      await db
        .prepare('INSERT INTO practice_note_reactions (note_id, member_id, emoji) VALUES (?, ?, ?)')
        .run(noteId, memberId, e);
    }
    // Return the fresh count for this emoji + whether the user now has it.
    const [{ count }] = await db
      .prepare('SELECT COUNT(*) AS count FROM practice_note_reactions WHERE note_id = ? AND emoji = ?')
      .all(noteId, e);
    return NextResponse.json({ success: true, emoji: e, count, mine: !existing });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
