import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import AdminAdminsClient from './AdminAdminsClient';

export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
  const session = await getSession(true);
  if (!session) redirect('/admin/login');

  const admins = await db.prepare(
    "SELECT id, name, email, phone, created_at FROM members WHERE role = 'admin' ORDER BY created_at"
  ).all();

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
