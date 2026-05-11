import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import EventForm from '@/components/events/EventForm';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }) {
  const session = await getSession();
  if (!hasPermission(session, 'events:manage')) redirect('/admin');

  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(params.eventId);
  if (!event) notFound();
  event.items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(event.id);

  const canAttendance = hasPermission(session, 'attendance:manage');
  const canRegistrations = hasPermission(session, 'registrations:manage');

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
    </div>
  );
}
