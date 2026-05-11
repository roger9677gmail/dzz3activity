import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

// List announcements visible to the current member:
//   - within (starts_at, ends_at) window — NULL means open-ended
//   - target groups intersect the member's groups
//   - pinned first, then newest by created_at
export const GET = withAuth(async (request) => {
  const memberId = request.session.sub;
  const rows = await db
    .prepare(
      `SELECT a.id, a.title, a.content, a.image, a.link_url,
              a.attachment_url, a.attachment_name,
              a.pinned, a.starts_at, a.ends_at, a.created_at, a.updated_at
         FROM announcements a
        WHERE (a.starts_at IS NULL OR a.starts_at <= NOW())
          AND (a.ends_at   IS NULL OR a.ends_at   >= NOW())
          AND EXISTS (
            SELECT 1 FROM announcement_groups ag
              JOIN member_group_assignments mga
                ON mga.group_id = ag.group_id AND mga.member_id = ?
             WHERE ag.announcement_id = a.id
          )
        ORDER BY a.pinned DESC, a.created_at DESC`
    )
    .all(memberId);
  return NextResponse.json({ announcements: rows });
});
