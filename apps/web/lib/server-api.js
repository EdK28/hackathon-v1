import { cookies } from 'next/headers';

const API_URL = process.env.API_URL || 'http://localhost:4100';

/**
 * Fetch from the Express API inside Server Components. Forwards the user's
 * auth cookie so dealer prices render on the server. Returns null on 404.
 */
export async function serverApi(path) {
  const cookieStore = await cookies();
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { cookie: cookieStore.toString() },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return res.json();
}
