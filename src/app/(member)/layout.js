import { redirect } from 'next/navigation';
import { getActiveSession } from '@/lib/auth';
import MemberNav from '@/components/layout/MemberNav';
import PushInstallPrompt from '@/components/pwa/PushInstallPrompt';
import BadgeClearer from '@/components/pwa/BadgeClearer';

export default async function MemberLayout({ children }) {
  // getActiveSession also checks is_disabled — suspended accounts with a stale
  // cookie get bounced back to the login screen.
  const session = await getActiveSession();
  if (!session) redirect('/login?disabled=1');

  return (
    <div className="min-h-screen bg-temple-cream pb-20">
      {children}
      <MemberNav />
      <PushInstallPrompt />
      <BadgeClearer />
    </div>
  );
}
