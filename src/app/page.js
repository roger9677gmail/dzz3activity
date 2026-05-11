import { redirect } from 'next/navigation';
import { getActiveSession } from '@/lib/auth';

export default async function Home() {
  const session = await getActiveSession();
  if (session) redirect(session.is_admin ? '/admin' : '/events');
  redirect('/login');
}
