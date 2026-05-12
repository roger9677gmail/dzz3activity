import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import EventForm from '@/components/events/EventForm';
import EventStaffEditor from '@/components/events/EventStaffEditor';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }) {
  const session = await getSession();
  if (!hasPermission(session, 'events:manage')) redirect('/admin');

  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(params.eventId);
  if (!event) notFound();
  event.items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(event.id);

  const canAttendance = hasPermission(session, 'attendance:manage');
  const canRegistrations = hasPermission(session, 'registrations:manage');

  // Pre-load staff + role suggestions for the staff editor.
  const staff = await db.prepare(
    `SELECT s.id, s.event_id, s.role_name, s.member_id, s.sort_order,
            m.name AS member_name, m.email AS member_email, m.phone AS member_phone,
            l.name AS location_name
       FROM event_staff s
       JOIN members m ON m.id = s.member_id
  LEFT JOIN locations l ON l.id = m.location_id
      WHERE s.event_id = ?
      ORDER BY s.sort_order, s.id`
  ).all(event.id);
  const suggestionRows = await db.prepare(
    `SELECT DISTINCT s.role_name FROM event_staff s
      WHERE s.event_id IN (SELECT id FROM events ORDER BY created_at DESC LIMIT 5)
      ORDER BY s.role_name`
  ).all();
  const suggestions = suggestionRows.map((r) => r.role_name);
  // Eligible members (any active member, including admins — admins can be staff too).
  const candidates = await db.prepare(
    `SELECT m.id, m.name, m.email, m.phone, l.name AS location_name
       FROM members m
  LEFT JOIN locations l ON l.id = m.location_id
      WHERE m.is_disabled = 0
      ORDER BY m.name`
  ).all();

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">編輯：{event.name}</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {canRegistrations && (
          <Link href={`/admin/events/${event.id}/registrations`} className="text-sm px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:border-temple-red">
            🧾 報名祈福名單
          </Link>
        )}
        {canAttendance && (
          <Link href={`/admin/events/${event.id}/attendance`} className="text-sm px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:border-temple-red">
            📋 活動登記表
          </Link>
        )}
      </div>
      <EventForm event={event} />
      <div className="mt-6">
        <EventStaffEditor
          eventId={event.id}
          initialStaff={staff}
          initialSuggestions={suggestions}
          candidates={candidates}
        />
      </div>
    </div>
  );
}
