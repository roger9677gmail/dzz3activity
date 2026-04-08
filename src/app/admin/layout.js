import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AdminSidebar from '@/components/layout/AdminSidebar';

export default async function AdminLayout({ children }) {
  const session = await getSession(true);

  // Allow access to admin login page without auth
  return (
    <div className="flex min-h-screen">
      {session && <AdminSidebar />}
      <main className={`flex-1 bg-gray-50 ${!session ? 'w-full' : ''}`}>{children}</main>
    </div>
  );
}
