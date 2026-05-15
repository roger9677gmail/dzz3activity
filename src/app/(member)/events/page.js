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

  // Batch-load event_items for ALL visible events in a single query, then group.
  const eventIds = events.map((e) => e.id);
  if (eventIds.length > 0) {
    const placeholders = eventIds.map(() => '?').join(',');
    const allItems = await db
      .prepare(`SELECT * FROM event_items WHERE event_id IN (${placeholders}) ORDER BY event_id, sort_order, id`)
      .all(...eventIds);
    const itemsByEventId = new Map();
    for (const it of allItems) {
      if (!itemsByEventId.has(it.event_id)) itemsByEventId.set(it.event_id, []);
      itemsByEventId.get(it.event_id).push(it);
    }
    for (const ev of events) ev.items = itemsByEventId.get(ev.id) || [];
  } else {
    for (const ev of events) ev.items = [];
  }

  // Pull this member's registrations + items in two batched queries (1 + 1).
  const myRegs = await db
    .prepare(
      `SELECT id, event_id, status, total_amount, payment_status,
              receipt_number, receipt_title, payment_date, notes, created_at
         FROM registrations
        WHERE member_id = ? AND status != 'cancelled'`
    )
    .all(session.sub);
  if (myRegs.length > 0) {
    const regIds = myRegs.map((r) => r.id);
    const placeholders = regIds.map(() => '?').join(',');
    const allRegItems = await db
      .prepare(
        `SELECT ri.id, ri.registration_id, ri.quantity, ri.names, ri.contents,
                ri.receipt_title, ri.subtotal, ri.is_gift, ei.name AS item_name
           FROM registration_items ri
           JOIN event_items ei ON ei.id = ri.event_item_id
          WHERE ri.registration_id IN (${placeholders})
          ORDER BY ri.registration_id, ri.is_gift, ri.id`
      )
      .all(...regIds);
    const itemsByRegId = new Map();
    for (const it of allRegItems) {
      if (!itemsByRegId.has(it.registration_id)) itemsByRegId.set(it.registration_id, []);
      itemsByRegId.get(it.registration_id).push(it);
    }
    for (const reg of myRegs) reg.items = itemsByRegId.get(reg.id) || [];
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

  // Which events am I staff for? (set of event_ids)
  let myStaffEventIds = new Set();
  try {
    const staffRows = await db
      .prepare('SELECT DISTINCT event_id FROM event_staff WHERE member_id = ?')
      .all(session.sub);
    myStaffEventIds = new Set(staffRows.map((r) => r.event_id));
  } catch (err) {
    console.error('[events list] staff lookup failed:', err);
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
                  isStaff={myStaffEventIds.has(ev.id)}
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
                  isStaff={myStaffEventIds.has(ev.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
