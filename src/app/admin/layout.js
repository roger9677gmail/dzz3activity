import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AdminSidebar from '@/components/layout/AdminSidebar';

export default async function AdminLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.is_admin) redirect('/events');

  return (
    <div className="min-h-screen md:flex">
      <AdminSidebar permissions={session.permissions || []} />
      <main className="flex-1 bg-gray-50 min-h-screen">{children}</main>
    </div>
  );
}
