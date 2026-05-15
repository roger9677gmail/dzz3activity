import { redirect, notFound } from 'next/navigation';
import { getActiveSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import EventForm from '@/components/events/EventForm';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }) {
  const session = await getActiveSession();
  if (!hasPermission(session, 'events:manage')) redirect('/admin');

  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(params.eventId);
  if (!event) notFound();
  event.items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(event.id);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">編輯：{event.name}</h1>
      <EventForm event={event} />
    </div>
  );
}
