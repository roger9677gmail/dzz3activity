import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import { formatDate, getEventStatusLabel, formatEventDateRange, formatDeadline } from '@/lib/utils';
import Link from 'next/link';
import DeleteEventButton from '@/components/events/DeleteEventButton';
import DuplicateEventButton from '@/components/events/DuplicateEventButton';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const session = await getSession();
  if (!hasPermission(session, 'events:manage')) redirect('/admin');

  // 排序：報名中 (start_date 遞增) → 草稿 (start_date 遞增) → 已截止 (start_date 遞減)
  const events = await db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r
         JOIN members m ON m.id = r.member_id
         WHERE r.event_id = e.id AND r.status != 'cancelled' AND m.is_disabled = 0) AS reg_count,
      (SELECT COUNT(*) FROM registrations r
         JOIN members m ON m.id = r.member_id
         WHERE r.event_id = e.id AND r.status != 'cancelled' AND r.payment_status = 'paid' AND m.is_disabled = 0) AS paid_count,
      (SELECT COUNT(*) FROM event_attendance a
         JOIN members m ON m.id = a.member_id
         WHERE a.event_id = e.id AND m.is_disabled = 0) AS att_count
    FROM events e
    ORDER BY
      CASE e.status WHEN 'active' THEN 1 WHEN 'draft' THEN 2 WHEN 'closed' THEN 3 ELSE 4 END,
      CASE WHEN e.status = 'closed' THEN -UNIX_TIMESTAMP(e.start_date) ELSE UNIX_TIMESTAMP(e.start_date) END,
      e.id
  `).all();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">活動管理</h1>
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
                    {formatEventDateRange(ev.start_date, ev.end_date)}
                  </div>
                  <div className="text-sm text-gray-400">報名截止：{formatDeadline(ev.registration_deadline)}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    ev.status === 'active' ? 'badge-active' :
                    ev.status === 'draft' ? 'bg-gray-100 text-gray-500' : 'badge-closed'
                  }`}>
                    {getEventStatusLabel(ev.status)}
                  </span>
                  <span className="text-sm text-gray-600">
                    {ev.reg_count} 祈福 ・ {ev.att_count} 活動
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/admin/events/${ev.id}`}
                  className="text-center text-sm py-1.5 px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                  編輯
                </Link>
                <Link href={`/admin/events/${ev.id}/registrations`}
                  className="flex-1 min-w-[8rem] text-center text-sm py-1.5 px-2 rounded-lg border border-temple-red text-temple-red hover:bg-red-50">
                  祈福名單 ({ev.reg_count})
                </Link>
                <Link href={`/admin/events/${ev.id}/attendance`}
                  className="flex-1 min-w-[8rem] text-center text-sm py-1.5 px-2 rounded-lg border border-blue-400 text-blue-600 hover:bg-blue-50">
                  活動名單 ({ev.att_count})
                </Link>
                <DuplicateEventButton eventId={ev.id} eventName={ev.name} />
                <DeleteEventButton eventId={ev.id} eventName={ev.name} regCount={ev.reg_count} paidCount={ev.paid_count} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
