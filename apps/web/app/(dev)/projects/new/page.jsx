'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';

export default function NewProject() {
  const router = useRouter();
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState({ clientName: '', clientEmail: '', name: '', template: 'feature', initialRequest: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    api('/projects/meta').then(setMeta);
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-black">New brief</h1>
      <p className="mt-1 text-sm text-mute">Clarify will interview your client with a short chat and turn their answers into a brief you can review.</p>

      <form
        className="mt-6 space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const { project } = await api('/projects', { method: 'POST', body: form });
            router.push(`/projects/${project.id}?new=1`);
          } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
          }
        }}
      >
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="clientName">Client name</label>
            <input id="clientName" className="input" required placeholder="e.g. Mr Tan" value={form.clientName} onChange={set('clientName')} />
          </div>
          <div>
            <label className="label" htmlFor="clientEmail">Client email (optional)</label>
            <input id="clientEmail" type="email" className="input" value={form.clientEmail} onChange={set('clientEmail')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">Project name</label>
            <input id="name" className="input" required placeholder="e.g. Homepage refresh" value={form.name} onChange={set('name')} />
          </div>
        </div>

        <fieldset className="card p-5">
          <legend className="label px-1">What kind of request is it?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(meta?.templates || []).map((t) => (
              <label key={t.id} className={`cursor-pointer rounded-lg border p-3 text-sm transition ${form.template === t.id ? 'border-accent bg-accent-soft' : 'border-line hover:border-ink'}`}>
                <input type="radio" name="template" value={t.id} checked={form.template === t.id} onChange={set('template')} className="sr-only" />
                <span className="font-semibold">{t.name}</span>
                <span className="mt-1 block text-xs text-mute">Asks about: {t.fields.slice(0, 5).join(', ')}{t.fields.length > 5 ? `, +${t.fields.length - 5} more` : ''}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="card p-5">
          <label className="label" htmlFor="initialRequest">The client&apos;s request, as they sent it (optional)</label>
          <textarea
            id="initialRequest"
            rows={4}
            className="input"
            placeholder={'Paste their WhatsApp message or email, e.g.\n"Can you make our website more modern and user friendly? Need it ASAP."'}
            value={form.initialRequest}
            onChange={set('initialRequest')}
          />
          <p className="mt-2 text-xs text-mute">Clarify spots vague words in it (like “modern” or “ASAP”) and asks the client what they mean.</p>
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create brief & get client link'}</button>
      </form>
    </div>
  );
}
