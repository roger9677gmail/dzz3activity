import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { formatDate, getEventStatusLabel } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const session = await getSession(true);
  if (!session) redirect('/admin/login');

  const events = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'cancelled') as reg_count
    FROM events e
    ORDER BY e.start_date DESC
  `).all();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">法會管理</h1>
        <Link href="/admin/events/new" className="btn-primary text-sm px-4 py-2">+ 新增活動</Link>
      </div>

      <div className="space-y-3">
        {events.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
            <div className="text-4xl mb-2">🏛️</div>
            <p>尚無活動</p>
          </div>
        )}
        {events.map((ev) => (
          <div key={ev.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: ev.banner_color || '#8B1A1A' }} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-gray-800">{ev.name}</h3>
                  <div className="text-sm text-gray-500 mt-1">
                    {formatDate(ev.start_date)}{ev.start_date !== ev.end_date ? ` ～ ${formatDate(ev.end_date)}` : ''}
                  </div>
                  <div className="text-sm text-gray-400">報名截止：{formatDate(ev.registration_deadline)}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    ev.status === 'active' ? 'badge-active' :
                    ev.status === 'draft' ? 'bg-gray-100 text-gray-500' : 'badge-closed'
                  }`}>
                    {getEventStatusLabel(ev.status)}
                  </span>
                  <span className="text-sm text-gray-600">{ev.reg_count} 人報名</span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Link href={`/admin/events/${ev.id}`}
                  className="flex-1 text-center text-sm py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                  編輯
                </Link>
                <Link href={`/admin/events/${ev.id}/registrations`}
                  className="flex-1 text-center text-sm py-1.5 rounded-lg border border-temple-red text-temple-red hover:bg-red-50">
                  查看名單 ({ev.reg_count})
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
