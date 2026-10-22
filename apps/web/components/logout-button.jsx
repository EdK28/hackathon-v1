'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="text-mute hover:text-ink"
      onClick={async () => {
        await api('/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
