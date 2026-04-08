import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import MemberNav from '@/components/layout/MemberNav';

export default async function MemberLayout({ children }) {
  const session = await getSession(false);
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-temple-cream pb-20">
      {children}
      <MemberNav />
    </div>
  );
}
