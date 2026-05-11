import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import { formatMoney } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard({ searchParams }) {
  const session = await getSession();
  if (!hasPermission(session, '*')) {
    // Anyone who can see /admin should hit this; we don't restrict the
    // overview by permission, but enforce a reasonable fallback if needed.
  }

  const locationId = searchParams.location ? parseInt(searchParams.location) : null;
  // For member filter we expose 「全體」 + each active location.
  const locations = await db.prepare(
    'SELECT id, name FROM locations WHERE active = 1 ORDER BY sort_order, id'
  ).all();
  const selectedLocation = locationId ? locations.find((l) => l.id === locationId) : null;

  // Members: include admins (they are still 師兄姐); exclude disabled.
  const memberClause = locationId
    ? 'WHERE is_disabled = 0 AND location_id = ?'
    : 'WHERE is_disabled = 0';
  const memberArgs = locationId ? [locationId] : [];
  const totalMembers = (await db.prepare(
    `SELECT COUNT(*) AS count FROM members ${memberClause}`
  ).get(...memberArgs)).count;

  // 進行中活動 (status='active')
  const totalEvents = (await db.prepare(
    "SELECT COUNT(*) AS count FROM events WHERE status = 'active'"
  ).get()).count;

  // 祈福項次數：SUM(quantity) of registration_items belonging to active events.
  // Location filter applies to the registering member.
  const qfItemsRow = await db.prepare(`
    SELECT COALESCE(SUM(ri.quantity), 0) AS sum
      FROM registration_items ri
      JOIN registrations r ON r.id = ri.registration_id
      JOIN events e ON e.id = r.event_id
      JOIN members m ON m.id = r.member_id
     WHERE e.status = 'active' AND r.status != 'cancelled' AND m.is_disabled = 0
       ${locationId ? 'AND m.location_id = ?' : ''}
  `).get(...(locationId ? [locationId] : []));
  const qfItemCount = qfItemsRow?.sum || 0;

  // 活動登記人次：event_attendance rows for active events
  const attendanceCount = (await db.prepare(`
    SELECT COUNT(*) AS count
      FROM event_attendance a
      JOIN events e ON e.id = a.event_id
      JOIN members m ON m.id = a.member_id
     WHERE e.status = 'active' AND m.is_disabled = 0
       ${locationId ? 'AND m.location_id = ?' : ''}
  `).get(...(locationId ? [locationId] : []))).count;

  // 繳款人數 (paid registrations) — active events
  const paidCount = (await db.prepare(`
    SELECT COUNT(*) AS count
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      JOIN members m ON m.id = r.member_id
     WHERE e.status = 'active' AND r.status != 'cancelled'
       AND r.payment_status = 'paid' AND m.is_disabled = 0
       ${locationId ? 'AND m.location_id = ?' : ''}
  `).get(...(locationId ? [locationId] : []))).count;

  // 待繳款 — active events
  const unpaidCount = (await db.prepare(`
    SELECT COUNT(*) AS count
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      JOIN members m ON m.id = r.member_id
     WHERE e.status = 'active' AND r.status != 'cancelled'
       AND r.payment_status = 'unpaid' AND m.is_disabled = 0
       ${locationId ? 'AND m.location_id = ?' : ''}
  `).get(...(locationId ? [locationId] : []))).count;

  // Per-event card stats (also filtered by location if set)
  const eventStats = await db.prepare(`
    SELECT e.id, e.name, e.start_date, e.status, e.banner_color,
      COUNT(r.id) AS reg_count,
      SUM(CASE WHEN r.payment_status='paid' THEN 1 ELSE 0 END) AS paid_count,
      SUM(CASE WHEN r.payment_status='unpaid' AND r.status != 'cancelled' THEN 1 ELSE 0 END) AS unpaid_count,
      SUM(CASE WHEN r.payment_status='paid' THEN r.total_amount ELSE 0 END) AS paid_amount,
      SUM(r.total_amount) AS total_amount
    FROM events e
    LEFT JOIN registrations r ON r.event_id = e.id AND r.status != 'cancelled'
    LEFT JOIN members m ON m.id = r.member_id
     WHERE e.status = 'active'
       AND (m.id IS NULL OR m.is_disabled = 0)
       ${locationId ? 'AND (m.id IS NULL OR m.location_id = ?)' : ''}
    GROUP BY e.id
    ORDER BY e.start_date
  `).all(...(locationId ? [locationId] : []));

  const stats = [
    { label: '師兄姐總數', value: totalMembers, icon: '👥', color: 'bg-blue-50 text-blue-700' },
    { label: '進行中活動', value: totalEvents, icon: '🏛️', color: 'bg-purple-50 text-purple-700' },
    { label: '祈福項次數', value: qfItemCount, icon: '🪔', color: 'bg-amber-50 text-amber-700' },
    { label: '活動登記人次', value: attendanceCount, icon: '🪷', color: 'bg-pink-50 text-pink-700' },
    { label: '繳款人數', value: paidCount, icon: '✅', color: 'bg-green-50 text-green-700' },
    { label: '待繳款', value: unpaidCount, icon: '💰', color: 'bg-yellow-50 text-yellow-700' },
  ];

  // Helper for chip hrefs that preserve no other state (overview has no other filters yet).
  function chipHref(locId) {
    return locId ? `?location=${locId}` : '/admin';
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">管理後台</h1>
        <p className="text-gray-500 text-sm mt-1">歡迎，{session.name} 管理員</p>
      </div>

      {/* Location filter chips */}
      <div className="bg-white rounded-xl p-3 shadow-sm mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 mr-1">道場篩選：</span>
          <Link
            href={chipHref(null)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              !locationId
                ? 'bg-temple-red text-white border-temple-red'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >全體師兄姐</Link>
          {locations.map((l) => {
            const active = locationId === l.id;
            return (
              <Link
                key={l.id}
                href={chipHref(l.id)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-temple-red text-white border-temple-red'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >🏯 {l.name}</Link>
            );
          })}
        </div>
        {selectedLocation && (
          <p className="text-xs text-gray-400 mt-2">
            目前統計範圍：{selectedLocation.name} 的師兄姐；活動數不受影響
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <div className="text-2xl mb-1" aria-hidden="true">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm opacity-75">{s.label}</div>
          </div>
        ))}
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
              <div className="mt-3 pt-2 border-t flex justify-between text-sm text-gray-500">
                <span>已收款金額</span>
                <span className="font-medium text-temple-red">{formatMoney(ev.paid_amount || 0)}</span>
              </div>
              {ev.total_amount > 0 && (
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>含未繳款共計</span>
                  <span>{formatMoney(ev.total_amount)}</span>
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
          🔍 報名查詢
        </Link>
      </div>
    </div>
  );
}
