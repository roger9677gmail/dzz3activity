import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

const PAGE_SIZE = 20;

// Public-notes feed (any signed-in user can read).
//   /api/notes/public?cursor=<id>   → next page (notes with id < cursor)
export const GET = withAuth(async (request) => {
  const memberId = request.session.sub;
  const { searchParams } = new URL(request.url);
  const cursor = parseInt(searchParams.get('cursor') || '0');

  const where = ['n.is_public = 1'];
  const args = [];
  if (cursor > 0) { where.push('n.id < ?'); args.push(cursor); }

  const rows = await db
    .prepare(
      `SELECT n.id, DATE_FORMAT(n.log_date, '%Y-%m-%d') AS log_date,
              n.content, n.image, n.link_url, n.created_at,
              m.id AS member_id, m.name AS member_name, m.avatar AS member_avatar,
              l.name AS location_name
         FROM practice_notes n
         JOIN members m ON m.id = n.member_id
    LEFT JOIN locations l ON l.id = m.location_id
        WHERE ${where.join(' AND ')}
        ORDER BY n.id DESC
        LIMIT ${PAGE_SIZE + 1}`
    )
    .all(...args);

  const hasMore = rows.length > PAGE_SIZE;
  const notes = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  // Batch-load reaction aggregates + my reactions + comment counts for the
  // visible page so the feed renders in one round-trip per axis.
  if (notes.length > 0) {
    const ids = notes.map((n) => n.id);
    const placeholders = ids.map(() => '?').join(',');

    const reactRows = await db
      .prepare(
        `SELECT note_id, emoji, COUNT(*) AS count
           FROM practice_note_reactions
          WHERE note_id IN (${placeholders})
          GROUP BY note_id, emoji`
      )
      .all(...ids);
    const myReactRows = await db
      .prepare(
        `SELECT note_id, emoji FROM practice_note_reactions
          WHERE member_id = ? AND note_id IN (${placeholders})`
      )
      .all(memberId, ...ids);
    const commentRows = await db
      .prepare(
        `SELECT note_id, COUNT(*) AS count FROM practice_note_comments
          WHERE note_id IN (${placeholders}) GROUP BY note_id`
      )
      .all(...ids);

    const byReact = new Map();
    for (const r of reactRows) {
      if (!byReact.has(r.note_id)) byReact.set(r.note_id, {});
      byReact.get(r.note_id)[r.emoji] = r.count;
    }
    const byMyReact = new Map();
    for (const r of myReactRows) {
      if (!byMyReact.has(r.note_id)) byMyReact.set(r.note_id, []);
      byMyReact.get(r.note_id).push(r.emoji);
    }
    const byComment = new Map();
    for (const r of commentRows) byComment.set(r.note_id, r.count);

    for (const n of notes) {
      n.reactions = byReact.get(n.id) || {};
      n.my_reactions = byMyReact.get(n.id) || [];
      n.comment_count = byComment.get(n.id) || 0;
    }
  }

  const nextCursor = hasMore ? notes[notes.length - 1].id : null;
  return NextResponse.json({ notes, nextCursor });
});
