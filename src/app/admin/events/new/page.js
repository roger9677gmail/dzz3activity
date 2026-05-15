import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, hasPermission } from '@/lib/auth';
import EventForm from '@/components/events/EventForm';

export default async function NewEventPage() {
  const session = await getSession();
  if (!hasPermission(session, 'events:manage')) redirect('/admin');

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1.5 text-sm text-temple-red hover:bg-red-50 px-3 py-1.5 -ml-1 rounded-lg font-medium border border-temple-red/30 transition-colors mb-3"
      >
        <span className="text-base leading-none">←</span>
        返回活動列表
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增法會活動</h1>
      <EventForm />
    </div>
  );
}
