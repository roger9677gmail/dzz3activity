import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import AdminAnnouncementsClient from './AdminAnnouncementsClient';

export const dynamic = 'force-dynamic';

export default async function AdminAnnouncementsPage() {
  const session = await getSession();
  if (!hasPermission(session, 'announcements:manage')) redirect('/admin');

  const announcements = await db
    .prepare(
      `SELECT a.id, a.title, a.pinned, a.starts_at, a.ends_at,
              a.created_at, a.updated_at,
              m.name AS created_by_name
         FROM announcements a
         LEFT JOIN members m ON m.id = a.created_by
        ORDER BY a.pinned DESC, a.created_at DESC`
    )
    .all();
  for (const a of announcements) {
    a.groups = await db
      .prepare(
        `SELECT g.id, g.name, g.color
           FROM announcement_groups ag JOIN member_groups g ON g.id = ag.group_id
          WHERE ag.announcement_id = ?
          ORDER BY g.sort_order, g.id`
      )
      .all(a.id);
  }
  // Locations (mirror groups) first, then regular tag groups; preserves the
  // mental model that 道場 are the primary segmentation.
  const groups = await db
    .prepare(
      `SELECT id, name, color, sort_order, location_id
         FROM member_groups
        WHERE active = 1
        ORDER BY (location_id IS NULL), sort_order, id`
    )
    .all();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">公告訊息</h1>
        <span className="text-sm text-gray-500">{announcements.length} 則</span>
      </div>
      <AdminAnnouncementsClient announcements={announcements} groups={groups} />
    </div>
  );
}
