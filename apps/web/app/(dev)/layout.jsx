import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/bits';
import { LogoutButton } from '@/components/logout-button';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function DevLayout({ children }) {
  const me = await serverApi('/auth/me').catch(() => null);
  if (!me?.user) redirect('/login');
  return (
    <>
      <header className="no-print border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/projects"><Logo /></Link>
          <nav className="text-sm">
            <Link href="/projects" className="text-ink-2 hover:text-ink">Briefs</Link>
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="hidden text-mute sm:inline">{me.user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
