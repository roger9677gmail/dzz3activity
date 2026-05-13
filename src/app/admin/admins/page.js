import { redirect } from 'next/navigation';
import { getSession, hasPermission, parsePermissions } from '@/lib/auth';
import db from '@/lib/db';
import AdminAdminsClient from './AdminAdminsClient';

export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
  const session = await getSession();
  if (!hasPermission(session, 'admins:manage')) redirect('/admin');

  const rows = await db.prepare(
    'SELECT id, name, email, phone, admin_permissions, created_at FROM members WHERE is_admin = 1 ORDER BY created_at'
  ).all();
  const admins = rows.map((a) => ({ ...a, admin_permissions: parsePermissions(a.admin_permissions) }));

  // Eligible promotion candidates: 已啟用、非管理員的師兄姐。
  const candidates = await db.prepare(
    `SELECT m.id, m.name, m.email, m.phone, l.name AS location_name
       FROM members m
  LEFT JOIN locations l ON l.id = m.location_id
      WHERE m.is_admin = 0 AND m.is_disabled = 0
      ORDER BY m.name`
  ).all();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">管理員設定</h1>
        <span className="text-sm text-gray-500">{admins.length} 位</span>
      </div>
      <AdminAdminsClient
        admins={admins}
        candidates={candidates}
        currentAdminId={Number(session.sub)}
      />
    </div>
  );
}
