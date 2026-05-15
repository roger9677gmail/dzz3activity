import { redirect } from 'next/navigation';
import { getActiveSession, hasPermission, parsePermissions } from '@/lib/auth';
import db from '@/lib/db';
import AdminAdminsClient from './AdminAdminsClient';

export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
  const session = await getActiveSession();
  if (!hasPermission(session, 'admins:manage')) redirect('/admin');

  const rows = await db.prepare(
    'SELECT id, name, email, phone, admin_permissions, created_at FROM members WHERE is_admin = 1 ORDER BY created_at'
  ).all();
  const admins = rows.map((a) => ({ ...a, admin_permissions: parsePermissions(a.admin_permissions) }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">管理員設定</h1>
        <span className="text-sm text-gray-500">{admins.length} 位</span>
      </div>
      <AdminAdminsClient admins={admins} currentAdminId={Number(session.sub)} />
    </div>
  );
}
