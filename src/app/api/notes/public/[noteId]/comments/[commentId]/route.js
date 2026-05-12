import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

// DELETE: only the comment's author can remove it. Note authors can remove
// their note (which CASCADEs comments) but not strangers' comments.
export const DELETE = withAuth(async (request, { params }) => {
  const memberId = Number(request.session.sub);
  const commentId = parseInt(params.commentId);
  if (!commentId) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });

  const c = await db
    .prepare('SELECT id, member_id FROM practice_note_comments WHERE id = ?')
    .get(commentId);
  if (!c) return NextResponse.json({ error: '留言不存在' }, { status: 404 });
  if (Number(c.member_id) !== memberId) {
    return NextResponse.json({ error: '只能刪除自己的留言' }, { status: 403 });
  }
  await db.prepare('DELETE FROM practice_note_comments WHERE id = ?').run(commentId);
  return NextResponse.json({ success: true });
});
