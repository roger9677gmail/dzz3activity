import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import EventCard from '@/components/events/EventCard';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const session = await getSession(false);

  const events = await db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'cancelled') as reg_count
    FROM events e
    WHERE e.status IN ('active', 'closed')
    ORDER BY e.start_date DESC
  `).all();

  for (const ev of events) {
    ev.items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(ev.id);
  }

  // Which events has this member registered for?
  const myRegRows = await db
    .prepare("SELECT event_id FROM registrations WHERE member_id = ? AND status != 'cancelled'")
    .all(session.sub);
  const myRegistrationIds = new Set(myRegRows.map((r) => r.event_id));

  const upcoming = events.filter((e) => e.status === 'active');
  const past = events.filter((e) => e.status !== 'active');

  return (
    <div>
      <div className="page-header">
        <h1 className="text-lg font-bold">法會活動</h1>
        <p className="text-red-200 text-sm">歡迎 {session.name} 師兄姐</p>
      </div>

      <div className="p-4 space-y-4">
        {upcoming.length === 0 && past.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🏛️</div>
            <p>目前暫無法會活動</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">報名中</h2>
            <div className="space-y-3">
              {upcoming.map((ev) => (
                <EventCard key={ev.id} event={ev} isRegistered={myRegistrationIds.has(ev.id)} />
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">已截止</h2>
            <div className="space-y-3">
              {past.map((ev) => (
                <EventCard key={ev.id} event={ev} isRegistered={myRegistrationIds.has(ev.id)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
