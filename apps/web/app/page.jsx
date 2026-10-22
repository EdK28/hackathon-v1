import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const me = await serverApi('/auth/me').catch(() => null);
  redirect(me?.user ? '/projects' : '/login');
}
