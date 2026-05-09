import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import MemberNav from '@/components/layout/MemberNav';
import PushInstallPrompt from '@/components/pwa/PushInstallPrompt';
import BadgeClearer from '@/components/pwa/BadgeClearer';

export default async function MemberLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-temple-cream pb-20">
      {children}
      <MemberNav />
      <PushInstallPrompt />
      <BadgeClearer />
    </div>
  );
}
