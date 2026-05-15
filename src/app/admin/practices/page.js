import { redirect } from 'next/navigation';
import { getActiveSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import AdminPracticesClient from './AdminPracticesClient';

export const dynamic = 'force-dynamic';

export default async function AdminPracticesPage() {
  const session = await getActiveSession();
  if (!hasPermission(session, 'practices:manage')) redirect('/admin');

  const practices = await db
    .prepare(
      'SELECT id, name, type, unit_label, sort_order, active, created_at FROM practices ORDER BY sort_order, id'
    )
    .all();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">功課項目管理</h1>
        <span className="text-sm text-gray-500">{practices.length} 項</span>
      </div>
      <AdminPracticesClient practices={practices} />
    </div>
  );
}
