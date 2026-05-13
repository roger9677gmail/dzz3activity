import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import AdminGroupsClient from './AdminGroupsClient';

export const dynamic = 'force-dynamic';

export default async function AdminGroupsPage() {
  const session = await getSession();
  if (!hasPermission(session, 'groups:manage')) redirect('/admin');

  const groups = await db
    .prepare(
      `SELECT g.id, g.name, g.color, g.sort_order, g.active, g.location_id, g.created_at,
              (SELECT COUNT(*) FROM member_group_assignments a
                 JOIN members m ON m.id = a.member_id
                WHERE a.group_id = g.id AND m.is_disabled = 0) AS member_count
         FROM member_groups g
        ORDER BY g.sort_order, g.id`
    )
    .all();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">群組標籤</h1>
        <span className="text-sm text-gray-500">{groups.length} 個群組</span>
      </div>
      <AdminGroupsClient groups={groups} />
    </div>
  );
}
