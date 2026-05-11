import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import EventCard from '@/components/events/EventCard';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const session = await getSession();

  const events = await db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r
         JOIN members m ON m.id = r.member_id
         WHERE r.event_id = e.id AND r.status != 'cancelled' AND m.is_disabled = 0) as reg_count
    FROM events e
    WHERE e.status IN ('active', 'closed')
    ORDER BY e.start_date DESC
  `).all();

  for (const ev of events) {
    ev.items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(ev.id);
  }

  // Pull this member's registrations (one per event by the UNIQUE constraint),
  // along with their items — so the EventCard can render a full summary inline.
  const myRegs = await db
    .prepare(
      `SELECT id, event_id, status, total_amount, payment_status,
              receipt_number, receipt_title, payment_date, notes, created_at
         FROM registrations
        WHERE member_id = ? AND status != 'cancelled'`
    )
    .all(session.sub);
  for (const reg of myRegs) {
    reg.items = await db
      .prepare(
        `SELECT ri.id, ri.quantity, ri.names, ri.contents, ri.subtotal, ri.is_gift,
                ei.name AS item_name
           FROM registration_items ri
           JOIN event_items ei ON ei.id = ri.event_item_id
          WHERE ri.registration_id = ?
          ORDER BY ri.is_gift, ri.id`
      )
      .all(reg.id);
  }
  const regByEventId = new Map(myRegs.map((r) => [r.event_id, r]));
  const myRegistrationIds = new Set(myRegs.map((r) => r.event_id));

  // Pull this member's attendance entries (本人 + 親友) across all events so
  // the EventCard can show a name summary even before opening the event.
  const allAttendance = await db
    .prepare(
      `SELECT event_id, id, attendee_name, attendee_relation
         FROM event_attendance
        WHERE member_id = ?
        ORDER BY event_id, (attendee_name IS NOT NULL), id`
    )
    .all(session.sub);
  const attendanceByEventId = new Map();
  for (const a of allAttendance) {
    if (!attendanceByEventId.has(a.event_id)) attendanceByEventId.set(a.event_id, []);
    attendanceByEventId.get(a.event_id).push(a);
  }

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
                <EventCard
                  key={ev.id} event={ev}
                  isRegistered={myRegistrationIds.has(ev.id)}
                  registration={regByEventId.get(ev.id) || null}
                  attendance={attendanceByEventId.get(ev.id) || []}
                />
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">已截止</h2>
            <div className="space-y-3">
              {past.map((ev) => (
                <EventCard
                  key={ev.id} event={ev}
                  isRegistered={myRegistrationIds.has(ev.id)}
                  registration={regByEventId.get(ev.id) || null}
                  attendance={attendanceByEventId.get(ev.id) || []}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
