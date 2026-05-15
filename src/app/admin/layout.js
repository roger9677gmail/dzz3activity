import { redirect } from 'next/navigation';
import { getActiveSession } from '@/lib/auth';
import AdminSidebar from '@/components/layout/AdminSidebar';

export default async function AdminLayout({ children }) {
  // Re-read from DB so sidebar permissions reflect the current state, not the
  // snapshot baked into the JWT at login time.
  const session = await getActiveSession();
  if (!session) redirect('/login');
  if (!session.is_admin) redirect('/events');

  return (
    <div className="min-h-screen md:flex">
      <AdminSidebar permissions={session.permissions || []} />
      <main className="flex-1 bg-gray-50 min-h-screen">{children}</main>
    </div>
  );
}
