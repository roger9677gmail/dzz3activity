import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import EventForm from '@/components/events/EventForm';

export default async function NewEventPage() {
  const session = await getSession(true);
  if (!session) redirect('/admin/login');

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增法會活動</h1>
      <EventForm />
    </div>
  );
}
