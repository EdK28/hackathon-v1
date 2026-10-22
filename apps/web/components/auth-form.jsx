'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/bits';
import { api, errorMessage } from '@/lib/api';

export function AuthForm({ mode }) {
  const router = useRouter();
  const register = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="mb-8 text-center">
        <Logo className="text-2xl" />
        <p className="mt-2 text-sm text-mute">Turn vague client requests into clear, signed-off briefs.</p>
      </div>
      <form
        className="card space-y-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: register ? form : { email: form.email, password: form.password } });
            router.push('/projects');
            router.refresh();
          } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
          }
        }}
      >
        {register && (
          <div>
            <label className="label" htmlFor="name">Your name (shown to clients)</label>
            <input id="name" className="input" required value={form.name} onChange={set('name')} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" required autoComplete="email" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" required minLength={register ? 8 : 1} autoComplete={register ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} />
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Log in'}</button>
        <p className="text-center text-sm text-mute">
          {register ? (
            <>Have an account? <Link href="/login" className="font-semibold text-ink underline">Log in</Link></>
          ) : (
            <>New here? <Link href="/register" className="font-semibold text-ink underline">Create an account</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
