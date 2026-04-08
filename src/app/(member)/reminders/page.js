import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { formatDate, daysUntil } from '@/lib/utils';
import PushSubscribe from '@/components/pwa/PushSubscribe';

export const dynamic = 'force-dynamic';

export default async function RemindersPage() {
  const session = await getSession(false);

  // Upcoming events the member registered for
  const upcomingRegistered = db.prepare(`
    SELECT e.id, e.name, e.start_date, e.end_date, e.location, e.banner_color
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE r.member_id = ? AND r.status != 'cancelled' AND e.start_date >= date('now')
    ORDER BY e.start_date
  `).all(session.sub);

  // Active events not yet registered
  const unregistered = db.prepare(`
    SELECT e.id, e.name, e.start_date, e.registration_deadline, e.banner_color
    FROM events e
    WHERE e.status = 'active'
      AND date(e.registration_deadline) >= date('now')
      AND e.id NOT IN (
        SELECT event_id FROM registrations
        WHERE member_id = ? AND status != 'cancelled'
      )
    ORDER BY e.registration_deadline
  `).all(session.sub);

  return (
    <div>
      <div className="page-header">
        <h1 className="text-lg font-bold">活動提醒</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Push notification opt-in */}
        <PushSubscribe />

        {/* Upcoming registered events */}
        {upcomingRegistered.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 mb-3">已報名即將到來</h2>
            <div className="space-y-3">
              {upcomingRegistered.map((ev) => {
                const days = daysUntil(ev.start_date);
                return (
                  <div key={ev.id} className="card overflow-hidden">
                    <div className="h-1.5" style={{ backgroundColor: ev.banner_color || '#8B1A1A' }} />
                    <div className="p-4 flex items-center gap-3">
                      <div className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: ev.banner_color || '#8B1A1A' }}>
                        {days <= 0 ? '今天' : `${days}天`}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-temple-dark truncate">{ev.name}</div>
                        <div className="text-sm text-gray-500">📅 {formatDate(ev.start_date)}</div>
                        {ev.location && <div className="text-sm text-gray-400">📍 {ev.location}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Events not yet registered */}
        {unregistered.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 mb-3">尚未報名（報名截止前）</h2>
            <div className="space-y-2">
              {unregistered.map((ev) => {
                const days = daysUntil(ev.registration_deadline);
                return (
                  <div key={ev.id} className="card p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{ev.name}</div>
                      <div className="text-xs text-gray-500">截止：{formatDate(ev.registration_deadline)}</div>
                    </div>
                    {days <= 7 && (
                      <span className="shrink-0 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                        剩{days}天
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {upcomingRegistered.length === 0 && unregistered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🔔</div>
            <p>目前無即將到來的活動</p>
          </div>
        )}
      </div>
    </div>
  );
}
