import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { formatMoney } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getSession(true);
  if (!session) redirect('/admin/login');

  const totalMembers = (await db.prepare("SELECT COUNT(*) as count FROM members WHERE role='member'").get()).count;
  const totalEvents = (await db.prepare("SELECT COUNT(*) as count FROM events WHERE status='active'").get()).count;
  const totalRegistrations = (await db.prepare("SELECT COUNT(*) as count FROM registrations WHERE status != 'cancelled'").get()).count;
  const totalRevenue = (await db.prepare("SELECT SUM(total_amount) as sum FROM registrations WHERE payment_status='paid'").get()).sum || 0;
  const unpaidCount = (await db.prepare("SELECT COUNT(*) as count FROM registrations WHERE payment_status='unpaid' AND status != 'cancelled'").get()).count;

  const eventStats = await db.prepare(`
    SELECT e.id, e.name, e.start_date, e.status, e.banner_color,
      COUNT(r.id) as reg_count,
      SUM(CASE WHEN r.payment_status='paid' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN r.payment_status='unpaid' AND r.status != 'cancelled' THEN 1 ELSE 0 END) as unpaid_count,
      SUM(r.total_amount) as total_amount
    FROM events e
    LEFT JOIN registrations r ON r.event_id = e.id AND r.status != 'cancelled'
    WHERE e.status = 'active'
    GROUP BY e.id
    ORDER BY e.start_date
  `).all();

  const stats = [
    { label: '師兄姐總數', value: totalMembers, icon: '👥', color: 'bg-blue-50 text-blue-700' },
    { label: '進行中活動', value: totalEvents, icon: '🏛️', color: 'bg-purple-50 text-purple-700' },
    { label: '總報名數', value: totalRegistrations, icon: '📋', color: 'bg-green-50 text-green-700' },
    { label: '待繳款', value: unpaidCount, icon: '💰', color: 'bg-yellow-50 text-yellow-700' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">管理後台</h1>
        <p className="text-gray-500 text-sm mt-1">歡迎，{session.name} 管理員</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm opacity-75">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">已收款金額</div>
            <div className="text-2xl font-bold text-temple-red mt-1">{formatMoney(totalRevenue)}</div>
          </div>
          <div className="text-4xl">💎</div>
        </div>
      </div>

      {/* Event stats */}
      <h2 className="text-base font-bold text-gray-700 mb-3">各活動報名狀況</h2>
      <div className="space-y-3">
        {eventStats.length === 0 && (
          <div className="bg-white rounded-xl p-6 text-center text-gray-400 shadow-sm">
            <p>尚無進行中的活動</p>
            <Link href="/admin/events/new" className="mt-2 inline-block text-temple-red text-sm font-medium">建立活動 →</Link>
          </div>
        )}
        {eventStats.map((ev) => (
          <div key={ev.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: ev.banner_color || '#8B1A1A' }} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">{ev.name}</h3>
                <Link href={`/admin/events/${ev.id}`} className="text-xs text-temple-red hover:underline">管理 →</Link>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-gray-700">{ev.reg_count || 0}</div>
                  <div className="text-xs text-gray-400">報名人數</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-600">{ev.paid_count || 0}</div>
                  <div className="text-xs text-gray-400">已繳款</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-yellow-600">{ev.unpaid_count || 0}</div>
                  <div className="text-xs text-gray-400">待繳款</div>
                </div>
              </div>
              {ev.total_amount > 0 && (
                <div className="mt-2 pt-2 border-t text-sm text-gray-500 flex justify-between">
                  <span>總金額</span>
                  <span className="font-medium text-temple-gold">{formatMoney(ev.total_amount)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/admin/events/new" className="bg-temple-red text-white rounded-xl p-4 text-center font-medium text-sm hover:bg-temple-red-dark">
          + 新增活動
        </Link>
        <Link href="/admin/reports" className="bg-white border border-gray-200 text-gray-700 rounded-xl p-4 text-center font-medium text-sm hover:bg-gray-50">
          📄 匯出報表
        </Link>
      </div>
    </div>
  );
}
