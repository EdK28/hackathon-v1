import Link from 'next/link';
import { Progress, StatusPill } from '@/components/bits';
import { serverApi } from '@/lib/server-api';
import { when } from '@/lib/ui';

export const metadata = { title: 'Briefs' };

export default async function Projects() {
  const [{ projects }, meta] = await Promise.all([serverApi('/projects'), serverApi('/projects/meta')]);
  const needsYou = projects.filter((p) => ['review', 'changed'].includes(p.status)).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Briefs</h1>
          <p className="text-sm text-mute">
            {projects.length} project{projects.length === 1 ? '' : 's'}
            {needsYou > 0 && <> · <b className="text-ink">{needsYou} need your attention</b></>}
          </p>
        </div>
        <Link href="/projects/new" className="btn-primary">+ New brief</Link>
      </div>

      {meta.engine === 'offline' && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Running the <b>offline</b> assistant (rule-based). Add <code className="font-mono">ANTHROPIC_API_KEY</code> to <code className="font-mono">apps/api/.env</code> to use Claude.
        </p>
      )}

      {projects.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold">No briefs yet</p>
          <p className="mt-1 text-sm text-mute">Paste a client&apos;s vague request and send them a link. Clarify asks the follow-up questions for you.</p>
          <Link href="/projects/new" className="btn-primary mt-4">Create your first brief</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card block p-5 transition hover:border-accent">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="truncate text-sm text-mute">{p.clientName} · {p.template}</p>
                </div>
                <StatusPill status={p.status} />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Progress value={p.completeness} />
                <span className="w-10 text-right text-xs tabular-nums text-mute">{p.completeness}%</span>
              </div>
              <div className="mt-3 flex justify-between text-xs text-mute">
                <span>{p.flags > 0 ? `⚠ ${p.flags} item${p.flags === 1 ? '' : 's'} to check` : 'No open issues'}</span>
                <span>Updated {when(p.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
