import { getSession } from '@/lib/auth';
import ImpersonationBannerClient from './ImpersonationBannerClient';

// Server component — reads the session cookie and only renders the sticky
// warning banner when the current request is an impersonation session.
// Mounted in the root layout so it appears on every page (member-side AND
// admin-side, because the admin might switch back to admin pages while still
// impersonating).
export default async function ImpersonationBanner() {
  const session = await getSession();
  if (!session?.imp?.admin_id) return null;
  return (
    <ImpersonationBannerClient
      targetName={session.name || ''}
      adminName={session.imp.admin_name || ''}
      mode={session.imp.mode || 'read'}
    />
  );
}
