'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Logo, Progress } from '@/components/bits';
import { Wireframe } from '@/components/wireframe';
import { api, errorMessage } from '@/lib/api';
import { answerText } from '@/lib/ui';

/** The client's side: a short chat that turns their request into a clear brief. */
export default function ClientChat() {
  const { token } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [other, setOther] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    api(`/c/${token}`).then((d) => setProject(d.project), (e) => setError(errorMessage(e)));
  }, [token]);

  // Bring the newest message's first line into view (not the bottom of the page,
  // which sits behind the answer panel on phones)
  useEffect(() => {
    const all = document.querySelectorAll('[data-msg]');
    const el = sending ? endRef.current : all[all.length - 1];
    el?.scrollIntoView({ behavior: 'smooth', block: sending ? 'end' : 'start' });
  }, [project?.messages?.length, sending]);

  if (error && !project) {
    return (
      <Shell>
        <p className="mt-20 text-center text-mute">{error}</p>
      </Shell>
    );
  }
  if (!project) return <Shell><p className="mt-20 text-center text-mute">Loading…</p></Shell>;

  // Older projects stored the sketch only on the brief: show it in the chat too
  const legacySketch = project.status !== 'gathering' && project.brief?.wireframe?.screens?.length && !project.messages.some((m) => m.kind === 'sketch');
  const msgs = legacySketch
    ? [...project.messages, { _id: 'legacy-sketch', role: 'assistant', kind: 'sketch', text: "Here's a rough sketch of how the pages could be laid out, based on your answers. Does it look like what you had in mind?", wireframe: project.brief.wireframe }]
    : project.messages;
  const lastSketch = msgs.findLastIndex((m) => m.kind === 'sketch');
  const last = msgs[msgs.length - 1];
  const asking = project.status === 'gathering' && last && last.role !== 'client' && last.question;
  const q = asking ? last.question : null;

  async function send(body) {
    setSending(true);
    setError('');
    // Show the answer immediately while the assistant thinks
    setProject((p) => ({ ...p, messages: [...p.messages, { role: 'client', answer: body, _optimistic: true }] }));
    try {
      const d = await api(`/c/${token}/answer`, { method: 'POST', body });
      setProject(d.project);
      setSelected([]);
      setOther('');
    } catch (e) {
      setError(errorMessage(e));
      setProject((p) => ({ ...p, messages: p.messages.filter((m) => !m._optimistic) }));
    }
    setSending(false);
  }

  const toggle = (opt) => {
    if (!q.multi) return send({ selected: [opt], other: '' }); // single choice: one tap answers
    setSelected((s) => (s.includes(opt) ? s.filter((x) => x !== opt) : [...s, opt]));
  };
  const canSend = (selected.length || other.trim()) && !sending;

  return (
    <Shell project={project}>
      <div className="flex-1 space-y-4 pb-6 pt-4">
        {msgs.map((m, i) => (
          <div key={m._id || i} data-msg className="scroll-mt-28">
            <Bubble m={m} developerName={project.developerName} latestSketch={i === lastSketch} />
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-mute" aria-live="polite">
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-mute" style={{ animationDelay: `${d * 120}ms` }} />
              ))}
            </span>
            Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {q && !sending && (
        <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper/95 px-4 pb-5 pt-3 backdrop-blur">
          <p className="mb-2 font-semibold leading-snug">{q.text}</p>
          {q.options?.length > 0 && (
            <>
              <p className="mb-2 text-xs text-mute">{q.multi ? 'Pick all that apply' : 'Tap one'}, or type your own answer.</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {q.options.map((o) => {
                  const on = selected.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => toggle(o)}
                      aria-pressed={q.multi ? on : undefined}
                      className={`rounded-full border px-3.5 py-2 text-sm transition ${on ? 'border-accent bg-accent text-white' : 'border-line bg-white hover:border-accent'}`}
                    >
                      {q.multi && <span className="mr-1">{on ? '✓' : '+'}</span>}
                      {o}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSend) send({ selected, other: other.trim() });
            }}
          >
            <textarea
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) send({ selected, other: other.trim() });
                }
              }}
              rows={1}
              placeholder={q.options?.length ? 'Something else? Type it here…' : 'Type your answer…'}
              className="input max-h-40 min-h-[42px] resize-none"
              aria-label="Your answer"
            />
            <button className="btn-primary h-[42px] shrink-0" disabled={!canSend}>
              Send
            </button>
          </form>
          <button type="button" onClick={() => send({ selected: ['Not sure yet'], other: '' })} className="mt-2 text-xs text-mute underline">
            I&apos;m not sure, skip this
          </button>
          {error && <p className="mt-2 text-sm text-bad">{error}</p>}
        </div>
      )}

      {project.status !== 'gathering' && <Finished project={project} token={token} />}
      {project.status !== 'gathering' && <FollowUp project={project} token={token} setProject={setProject} />}
    </Shell>
  );
}

function Shell({ project, children }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4">
      <header className="sticky top-0 z-10 -mx-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{project?.name || 'Project brief'}</p>
            {project && <p className="truncate text-xs text-mute">For {project.developerName} · about 5 minutes</p>}
          </div>
          <Logo className="shrink-0 text-sm text-mute" />
        </div>
        {project && (
          <div className="mt-2 flex items-center gap-2">
            <Progress value={project.completeness} />
            <span className="w-10 text-right text-xs tabular-nums text-mute">{project.completeness}%</span>
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

function Bubble({ m, developerName, latestSketch }) {
  if (m.kind === 'sketch' && m.wireframe) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold text-mute">Assistant</p>
        <div className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-white px-4 py-2.5 text-[15px] shadow-sm">{m.text}</div>
        {latestSketch ? (
          <div className="card mt-3 p-3 sm:p-4">
            <Wireframe wireframe={m.wireframe} />
          </div>
        ) : (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-mute underline">Show this earlier sketch</summary>
            <div className="card mt-2 p-3 opacity-80">
              <Wireframe wireframe={m.wireframe} />
            </div>
          </details>
        )}
      </div>
    );
  }
  if (m.role === 'client') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] text-white">{answerText(m.answer)}</p>
      </div>
    );
  }
  const who = m.role === 'developer' ? developerName : 'Assistant';
  const showQ = m.question && !m.text?.includes(m.question.text);
  return (
    <div className="max-w-[90%]">
      <p className="mb-1 text-xs font-semibold text-mute">{who}</p>
      <div className={`whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-2.5 text-[15px] ${m.role === 'developer' ? 'border border-accent/30 bg-accent-soft' : 'bg-white shadow-sm'}`}>
        {m.text}
        {showQ && <p className="mt-2 font-semibold">{m.question.text}</p>}
      </div>
    </div>
  );
}

/** After the interview the chat stays open: confirm the sketch or ask for changes in plain words. */
function FollowUp({ project, token, setProject }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasSketch = project.brief?.wireframe?.screens?.length > 0;

  async function post(path, body, optimistic) {
    setBusy(true);
    setError('');
    setProject((p) => ({ ...p, messages: [...p.messages, { role: 'client', answer: optimistic, _optimistic: true }] }));
    try {
      setProject((await api(`/c/${token}/${path}`, { method: 'POST', body })).project);
      setText('');
    } catch (e) {
      setError(errorMessage(e));
      setProject((p) => ({ ...p, messages: p.messages.filter((m) => !m._optimistic) }));
    }
    setBusy(false);
  }
  const sendText = () => text.trim() && !busy && post('message', { text: text.trim() }, { selected: [], other: text.trim() });

  return (
    <div className="no-print sticky bottom-0 -mx-4 border-t border-line bg-paper/95 px-4 pb-5 pt-3 backdrop-blur">
      {busy && <p className="mb-2 text-sm text-mute" aria-live="polite">{hasSketch ? 'Updating the sketch…' : 'Sending…'}</p>}
      {hasSketch && !project.brief.wireframeOk && !busy && (
        <div className="mb-2 flex flex-wrap gap-2">
          <button type="button" className="rounded-full border border-accent bg-accent px-3.5 py-2 text-sm text-white" onClick={() => post('wireframe-ok', undefined, { selected: ['👍 Looks right'], other: '' })}>
            👍 Looks right
          </button>
        </div>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendText();
            }
          }}
          rows={1}
          placeholder={hasSketch ? 'Tell me what to change, e.g. “add a Compare button next to Add to cart”' : `Message ${project.developerName}…`}
          className="input max-h-40 min-h-[42px] resize-none"
          aria-label="Your message"
        />
        <button className="btn-primary h-[42px] shrink-0" disabled={busy || !text.trim()}>Send</button>
      </form>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </div>
  );
}

function Finished({ project, token }) {
  const awaiting = project.status === 'awaiting_signoff';
  const signed = project.status === 'signed' || project.status === 'changed';
  return (
    <div className="card mb-8 p-5 text-center">
      {awaiting ? (
        <>
          <p className="font-semibold">Your brief is ready to approve</p>
          <p className="mt-1 text-sm text-mute">It includes a rough sketch of the pages. Please check it carefully. This is what {project.developerName} will build.</p>
          <Link href={`/b/${token}/brief`} className="btn-primary mt-4">Review &amp; approve</Link>
        </>
      ) : signed ? (
        <>
          <p className="font-semibold">You approved this brief</p>
          <Link href={`/b/${token}/brief`} className="btn-ghost mt-4">View brief</Link>
        </>
      ) : (
        <>
          <p className="font-semibold">Thank you! 🎉</p>
          <p className="mt-1 text-sm text-mute">{project.developerName} will review your answers and send you a brief to approve.</p>
        </>
      )}
    </div>
  );
}
