'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Progress, StatusPill } from '@/components/bits';
import { BriefView } from '@/components/brief-view';
import { Wireframe } from '@/components/wireframe';
import { api, errorMessage } from '@/lib/api';
import { answerText, when } from '@/lib/ui';

function ProjectPage() {
  const { id } = useParams();
  const isNew = useSearchParams().get('new');
  const [p, setP] = useState(null);
  const [tab, setTab] = useState('brief');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => api(`/projects/${id}`).then((d) => setP(d.project), (e) => setError(errorMessage(e))), [id]);
  useEffect(() => {
    load();
    // While the client is still answering, refresh every 10s so you can watch it fill in
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 10000);
    return () => clearInterval(t);
  }, [load]);

  if (!p) return <p className="text-mute">{error || 'Loading…'}</p>;

  const act = async (fn) => {
    setError('');
    setNotice('');
    try {
      const r = await fn();
      setP(r.project);
      if (r.notice) setNotice(r.notice);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const unresolved = (p.brief.vague || []).filter((v) => !v.resolved);
  const attention = [
    ...(p.brief.contradictions || []).map((t) => ({ kind: 'Contradiction', t })),
    ...unresolved.map((v) => ({ kind: 'Vague', t: `“${v.quote}” hasn't been clarified yet` })),
    ...(p.brief.openQuestions || []).map((t) => ({ kind: 'Open', t })),
  ];

  return (
    <div>
      <Link href="/projects" className="no-print text-sm text-mute">← All briefs</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-black">{p.name}</h1>
          <p className="text-sm text-mute">{p.clientName} · {p.template.name} · assistant: {p.engine}</p>
        </div>
        <StatusPill status={p.status} />
      </div>
      <div className="mt-3 flex max-w-md items-center gap-3">
        <Progress value={p.completeness} />
        <span className="whitespace-nowrap text-xs tabular-nums text-mute">{p.completeness}% complete</span>
      </div>

      <ShareBox p={p} highlight={isNew} />

      {p.changes?.length > 0 && (
        <div className="no-print mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-900">Changed since the client signed version {p.signedVersion}</p>
          <ul className="mt-2 space-y-2 text-sm">
            {p.changes.map((c) => (
              <li key={c.key}>
                <b>{c.label}:</b> <span className="text-red-800 line-through">{c.before || '(empty)'}</span> → <span className="text-green-800">{c.after || '(empty)'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-900">Send the updated brief so the client can approve the change.</p>
        </div>
      )}

      {p.brief.feedback?.length > 0 && (
        <div className="no-print mt-6 rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="font-semibold text-sky-900">Client asked for changes ({p.brief.feedback.length})</p>
          <ul className="mt-2 space-y-1 text-sm">
            {p.brief.feedback.map((f, i) => (
              <li key={i}>
                “{f.text}” <span className="text-xs text-mute">· {when(f.at)}</span>{' '}
                {f.applied ? <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-green-800">✓ applied to sketch</span> : <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-amber-800">needs you</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-sky-900">Layout requests are applied to the sketch automatically. For ones marked “needs you”, edit the brief or type an instruction on the Wireframe tab, then send the updated version.</p>
        </div>
      )}

      {attention.length > 0 && (
        <div className="no-print mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Check before you build ({attention.length})</p>
          <ul className="mt-2 space-y-1 text-sm">
            {attention.map((a, i) => (
              <li key={i}><span className="mr-2 rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-amber-900">{a.kind}</span>{a.t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="no-print mt-8 flex gap-1 border-b border-line">
        {[['brief', 'Brief'], ['wireframe', 'Wireframe'], ['chat', `Conversation (${p.messages.filter((m) => m.role === 'client').length} answers)`], ['versions', `Versions (${p.versions.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? 'border-accent text-ink' : 'border-transparent text-mute hover:text-ink'}`}>
            {l}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-bad">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm" role="status">{notice}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {tab === 'brief' && <BriefTab p={p} act={act} />}
          {tab === 'wireframe' &&
            (p.brief.wireframe?.screens?.length ? (
              <>
                <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${p.brief.wireframeOk ? 'bg-green-50 text-green-900' : 'bg-white text-mute ring-1 ring-line'}`}>
                  {p.brief.wireframeOk
                    ? `✓ ${p.clientName} said this sketch looks right (${when(p.brief.wireframeOk)}).`
                    : p.status === 'gathering'
                      ? 'The client will see this sketch in their chat when they finish answering.'
                      : `${p.clientName} sees this sketch in their chat and can confirm it or ask for changes.`}
                </p>
                <Wireframe key={JSON.stringify(p.brief.wireframe).length + p.updatedAt} wireframe={p.brief.wireframe} />
                <SketchInstruction p={p} act={act} />
              </>
            ) : (
              <p className="text-sm text-mute">The wireframe is drawn automatically once the client finishes answering. You can also generate it from the sidebar.</p>
            ))}
          {tab === 'chat' && <Transcript p={p} />}
          {tab === 'versions' && <Versions p={p} />}
        </div>
        <Actions p={p} act={act} />
      </div>
    </div>
  );
}

function ShareBox({ p, highlight }) {
  const [copied, setCopied] = useState(false);
  const msg = `Hi ${p.clientName}, to make sure I build exactly what you need, please answer a few quick questions here (about 5 minutes): ${p.clientLink}`;
  return (
    <div className={`no-print mt-6 rounded-xl border p-4 ${highlight ? 'border-accent bg-accent-soft' : 'border-line bg-white'}`}>
      <p className="text-sm font-semibold">{highlight ? '✓ Brief created. Send this link to your client' : 'Client link'}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input readOnly value={p.clientLink} className="input max-w-md flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="Client link" />
        <button
          className="btn-ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(msg);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? 'Copied!' : 'Copy message'}
        </button>
        <a className="btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
        <a className="btn-ghost" href={p.clientLink} target="_blank" rel="noreferrer">Open as client</a>
      </div>
    </div>
  );
}

function BriefTab({ p, act }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  if (!editing) {
    return (
      <div>
        <div className="no-print mb-4 flex justify-end">
          <button className="btn-ghost" onClick={() => { setDraft({ ...p.brief.fields, __summary: p.brief.summary || '' }); setEditing(true); }}>Edit brief</button>
        </div>
        <BriefView project={p} />
      </div>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const { __summary, ...fields } = draft;
        await act(() => api(`/projects/${p.id}/brief`, { method: 'PATCH', body: { fields, summary: __summary } }));
        setEditing(false);
      }}
    >
      {p.status === 'signed' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">This brief is signed. Saving changes will mark it as changed and you&apos;ll need the client to approve again.</p>}
      <div>
        <label className="label">Summary</label>
        <textarea rows={3} className="input" value={draft.__summary} onChange={(e) => setDraft({ ...draft, __summary: e.target.value })} />
      </div>
      {p.template.fields.map((f) => (
        <div key={f.key}>
          <label className="label" htmlFor={`f-${f.key}`}>{f.label}</label>
          <textarea id={`f-${f.key}`} rows={2} className="input" value={draft[f.key] || ''} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
        </div>
      ))}
      <div className="flex gap-2">
        <button className="btn-primary">Save changes</button>
        <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>
  );
}

/** Developer types a change in plain words; it's applied the same way as the client's requests. */
function SketchInstruction({ p, act }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="no-print mt-6 rounded-xl border border-line bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await act(async () => {
          const r = await api(`/projects/${p.id}/wireframe`, { method: 'POST', body: { request: text.trim() } });
          if (!/Couldn't/.test(r.notice || '')) setText('');
          return r;
        });
        setBusy(false);
      }}
    >
      <label className="font-semibold" htmlFor="sketch-change">Change the sketch</label>
      <p className="mt-1 text-xs text-mute">Type what to change. The new sketch is posted in the client&apos;s chat.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input id="sketch-change" className="input min-w-0 flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. add a Compare button next to Add to cart" />
        <button className="btn-dark" disabled={busy || text.trim().length < 3}>{busy ? 'Updating…' : 'Update sketch'}</button>
      </div>
    </form>
  );
}

function Transcript({ p }) {
  return (
    <ol className="space-y-3">
      {p.initialRequest && (
        <li className="rounded-lg border border-dashed border-line p-3 text-sm">
          <span className="label">Original request</span>“{p.initialRequest}”
        </li>
      )}
      {p.messages.map((m) => (
        <li key={m._id} className={`rounded-lg p-3 text-sm ${m.role === 'client' ? 'ml-10 bg-accent-soft' : 'mr-10 bg-white shadow-sm'}`}>
          <p className="mb-1 text-xs font-semibold text-mute">{m.role === 'client' ? p.clientName : m.role === 'developer' ? 'You' : 'Assistant'} · {when(m.at)}</p>
          <p className="whitespace-pre-wrap">{m.role === 'client' ? answerText(m.answer) : m.text}</p>
          {m.kind === 'sketch' && <p className="mt-1 text-xs font-semibold text-accent">📐 Sketch sent to the client ({m.wireframe?.screens?.length || 0} screen{m.wireframe?.screens?.length === 1 ? '' : 's'})</p>}
          {m.question && m.role !== 'client' && !m.text?.includes(m.question.text) && <p className="mt-1 font-semibold">{m.question.text}</p>}
          {m.question?.options?.length > 0 && m.role !== 'client' && <p className="mt-1 text-xs text-mute">Options: {m.question.options.join(' · ')}</p>}
        </li>
      ))}
    </ol>
  );
}

function Versions({ p }) {
  if (!p.versions.length) return <p className="text-sm text-mute">No versions yet. Send the brief for sign-off to create version 1.</p>;
  return (
    <ul className="space-y-2">
      {[...p.versions].reverse().map((v) => (
        <li key={v.n} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
          <span><b>Version {v.n}</b> · sent {when(v.createdAt)}{v.note ? ` · “${v.note}”` : ''}</span>
          {v.signedAt ? <span className="text-ok">✓ Signed by {v.signedBy}, {when(v.signedAt)}</span> : <span className="text-mute">Not signed</span>}
        </li>
      ))}
    </ul>
  );
}

function Actions({ p, act }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const run = async (key, fn) => {
    setBusy(key);
    await act(fn);
    setBusy('');
  };
  const canSend = ['review', 'changed', 'signed'].includes(p.status) && p.status !== 'signed';

  return (
    <aside className="no-print space-y-4">
      <div className="card p-4">
        <p className="font-semibold">Ask the client something</p>
        <p className="mt-1 text-xs text-mute">It appears in their chat. Options are optional (one per line).</p>
        <textarea rows={2} className="input mt-3" placeholder="e.g. Should prices include SST?" value={q} onChange={(e) => setQ(e.target.value)} />
        <textarea rows={2} className="input mt-2" placeholder={'With SST\nWithout SST'} value={opts} onChange={(e) => setOpts(e.target.value)} />
        <button
          className="btn-dark mt-2 w-full"
          disabled={q.trim().length < 3 || busy}
          onClick={() =>
            run('ask', async () => {
              const r = await api(`/projects/${p.id}/ask`, { method: 'POST', body: { text: q.trim(), options: opts.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6) } });
              setQ('');
              setOpts('');
              return r;
            })
          }
        >
          {busy === 'ask' ? 'Sending…' : 'Send question'}
        </button>
      </div>

      <div className="card p-4">
        <p className="font-semibold">Get client approval</p>
        <p className="mt-1 text-xs text-mute">Freezes this version and lets the client approve it from their link.</p>
        <input className="input mt-3" placeholder="Note to client (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary mt-2 w-full" disabled={!canSend || busy} onClick={() => run('send', () => api(`/projects/${p.id}/send`, { method: 'POST', body: { note: note || undefined } }))}>
          {busy === 'send' ? 'Sending…' : p.status === 'changed' ? 'Send updated version' : 'Send for sign-off'}
        </button>
        {!canSend && <p className="mt-2 text-xs text-mute">{p.status === 'gathering' ? 'Available once the client finishes answering.' : p.status === 'awaiting_signoff' ? 'Waiting for the client to approve.' : 'Already signed.'}</p>}
      </div>

      <div className="card space-y-2 p-4">
        <p className="font-semibold">Brief</p>
        <button className="btn-ghost w-full" disabled={!!busy} onClick={() => run('stories', () => api(`/projects/${p.id}/stories`, { method: 'POST' }))}>
          {busy === 'stories' ? 'Writing…' : 'Regenerate user stories'}
        </button>
        <button className="btn-ghost w-full" disabled={!!busy || p.status === 'gathering'} onClick={() => run('wireframe', () => api(`/projects/${p.id}/wireframe`, { method: 'POST' }))}>
          {busy === 'wireframe'
            ? 'Updating…'
            : !p.brief.wireframe?.screens?.length
              ? 'Generate wireframe'
              : (p.brief.feedback || []).some((f) => !f.applied)
                ? `Apply client changes to wireframe (${p.brief.feedback.filter((f) => !f.applied).length})`
                : 'Redraw wireframe from brief'}
        </button>
        <a className="btn-ghost w-full" href={`/api/projects/${p.id}/brief.md`}>Download Markdown</a>
        <button className="btn-ghost w-full" onClick={() => window.print()}>Print / PDF</button>
      </div>
    </aside>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ProjectPage />
    </Suspense>
  );
}
