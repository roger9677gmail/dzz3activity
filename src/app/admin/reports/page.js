import { redirect } from 'next/navigation';
import { getActiveSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const session = await getActiveSession();
  if (!hasPermission(session, 'reports:view')) redirect('/admin');

  const events = await db.prepare("SELECT id, name FROM events ORDER BY start_date DESC").all();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">報表匯出</h1>
      <ReportsClient events={events} />
    </div>
  );
}
