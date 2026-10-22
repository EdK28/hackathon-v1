'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/bits';
import { BriefView } from '@/components/brief-view';
import { Wireframe } from '@/components/wireframe';
import { api, errorMessage } from '@/lib/api';
import { when } from '@/lib/ui';

export default function ClientBrief() {
  const { token } = useParams();
  const [project, setProject] = useState(null);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/c/${token}`).then((d) => setProject(d.project), (e) => setError(errorMessage(e)));
  }, [token]);

  if (!project) return <p className="mt-20 text-center text-mute">{error || 'Loading…'}</p>;
  const signed = project.versions.find((v) => v.n === project.signedVersion);
  const latest = project.versions.at(-1);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/b/${token}`} className="text-sm text-mute">← Back to chat</Link>
        <Logo className="text-sm text-mute" />
      </div>
      <p className="label">Project brief{latest ? ` · version ${latest.n}` : ''}</p>
      <h1 className="text-3xl font-black">{project.name}</h1>
      <p className="mt-1 text-sm text-mute">Prepared by {project.developerName} for {project.clientName}</p>
      {latest?.note && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">Note from {project.developerName}: {latest.note}</p>}

      {project.brief?.wireframe?.screens?.length > 0 && (
        <section className="mt-8" aria-labelledby="wf-h">
          <h2 id="wf-h" className="text-xl font-black">How it could be laid out</h2>
          <p className="mb-4 mt-1 text-sm text-mute">
            A rough sketch based on your answers, so you can check we understood you. The numbered notes show which of your answers each part comes from.
          </p>
          <div className="card p-4">
            <Wireframe wireframe={project.brief.wireframe} />
          </div>
          {['awaiting_signoff', 'review'].includes(project.status) && (
            <FeedbackForm token={token} developerName={project.developerName} feedback={project.brief.feedback || []} onSaved={setProject} />
          )}
        </section>
      )}

      <div className="mt-10">
        <BriefView project={project} audience="client" />
      </div>

      <div className="card mt-10 p-5 no-print">
        {project.status === 'awaiting_signoff' ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                setProject((await api(`/c/${token}/signoff`, { method: 'POST', body: { name, agree } })).project);
              } catch (err) {
                setError(errorMessage(err));
              }
              setBusy(false);
            }}
          >
            <p className="font-semibold">Approve this brief</p>
            <p className="mt-1 text-sm text-mute">
              Approving means this is what you want built. Anything not listed here, or changed later, may affect the timeline and cost.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="label" htmlFor="name">Your full name</label>
                <input id="name" className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <button className="btn-primary" disabled={busy || !agree || name.trim().length < 2}>{busy ? 'Saving…' : 'Approve brief'}</button>
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              I have read this brief and it describes what I want.
            </label>
            <p className="mt-3 text-sm text-mute">
              Something wrong? <Link href={`/b/${token}`} className="underline">Tell {project.developerName} in the chat</Link> or reply to them directly instead of approving.
            </p>
            {error && <p className="mt-2 text-sm text-bad">{error}</p>}
          </form>
        ) : signed ? (
          <p className="text-sm">
            ✅ Approved by <b>{signed.signedBy}</b> on {when(signed.signedAt)} (version {signed.n}).
            {project.status === 'changed' && ' The developer has since made changes and will send a new version to approve.'}
          </p>
        ) : (
          <p className="text-sm text-mute">This brief is still being prepared. You&apos;ll be asked to approve it when it&apos;s ready.</p>
        )}
      </div>
      <button onClick={() => window.print()} className="btn-ghost mt-4 no-print">Print / save as PDF</button>
    </div>
  );
}

function FeedbackForm({ token, developerName, feedback, onSaved }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div className="no-print mt-4 rounded-xl border border-line bg-white p-4">
      <p className="font-semibold">Not quite what you had in mind?</p>
      <p className="mt-1 text-sm text-mute">Tell {developerName} what to change before you approve. For example: “Put the WhatsApp button at the top” or “I don&apos;t need an account page”.</p>
      {feedback.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {feedback.map((f, i) => <li key={i} className="rounded bg-accent-soft px-2 py-1">You said: “{f.text}”</li>)}
        </ul>
      )}
      <form
        className="mt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            onSaved((await api(`/c/${token}/feedback`, { method: 'POST', body: { text } })).project);
            setText('');
            setSent(true);
          } catch (err) {
            setError(errorMessage(err));
          }
          setBusy(false);
        }}
      >
        <label className="sr-only" htmlFor="fb">Your changes</label>
        <textarea id="fb" rows={3} className="input" value={text} onChange={(e) => { setText(e.target.value); setSent(false); }} placeholder="What should be different?" />
        <button className="btn-dark mt-2" disabled={busy || text.trim().length < 3}>{busy ? 'Sending…' : 'Request changes'}</button>
        {sent && <p className="mt-2 text-sm text-ok">Sent. {developerName} will update the brief and send you a new version to approve.</p>}
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      </form>
    </div>
  );
}
