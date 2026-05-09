import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import AdminLocationsClient from './AdminLocationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminLocationsPage() {
  const session = await getSession();
  if (!hasPermission(session, 'locations:manage')) redirect('/admin');

  const locations = await db.prepare(`
    SELECT l.id, l.name, l.sort_order, l.active, l.created_at,
      (SELECT COUNT(*) FROM members m WHERE m.location_id = l.id) AS member_count
    FROM locations l
    ORDER BY l.sort_order, l.id
  `).all();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">道場管理</h1>
        <span className="text-sm text-gray-500">{locations.length} 個道場</span>
      </div>
      <AdminLocationsClient locations={locations} />
    </div>
  );
}
