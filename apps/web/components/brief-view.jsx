/**
 * Read-only brief, shared by the developer page and the client approval page.
 * `audience="client"` hides internal notes like contradictions.
 */
export function BriefView({ project, audience = 'developer' }) {
  const b = project.brief || {};
  const fields = b.fields || {};
  const clarified = (b.vague || []).filter((v) => v.resolved);
  return (
    <div className="space-y-8">
      {b.summary && (
        <section>
          <h2 className="label">Summary</h2>
          <p className="text-[15px] leading-relaxed">{b.summary}</p>
        </section>
      )}

      <section>
        <h2 className="label">What we agreed</h2>
        <dl className="card divide-y divide-line">
          {project.template.fields.map((f) => (
            <div key={f.key} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
              <dt className="text-sm font-semibold text-ink-2">{f.label}</dt>
              <dd className={`text-sm ${fields[f.key] ? '' : 'italic text-mute'}`}>{fields[f.key] || 'Not answered yet'}</dd>
            </div>
          ))}
        </dl>
      </section>

      {clarified.length > 0 && (
        <section>
          <h2 className="label">Words we clarified</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {clarified.map((v, i) => (
              <li key={i} className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
                <span className="text-mute">“{v.quote}” means</span> <b>{v.answer}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {b.stories?.length > 0 && (
        <section>
          <h2 className="label">What will be built</h2>
          <ol className="space-y-3">
            {b.stories.map((s, i) => (
              <li key={i} className="card p-4">
                <p className="text-sm">
                  <span className="mr-2 font-mono text-xs text-mute">{String(i + 1).padStart(2, '0')}</span>
                  As a <b>{s.asA}</b>, I want <b>{s.iWant}</b>, so that {s.soThat}.
                </p>
                {s.acceptance?.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-7 text-sm text-ink-2">
                    {s.acceptance.map((a, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded border border-mute" aria-hidden="true" />
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-mute">Each checkbox is how we&apos;ll test that the item is done.</p>
        </section>
      )}

      <ListSection title="Assumptions" items={b.assumptions} />
      <ListSection title="Still to decide" items={b.openQuestions} />
      {audience === 'developer' && (
        <>
          <ListSection title="Answers to your questions" items={b.notes} />
          <ListSection title="Risks" items={b.risks} tone="text-bad" />
        </>
      )}
    </div>
  );
}

function ListSection({ title, items, tone = '' }) {
  if (!items?.length) return null;
  return (
    <section>
      <h2 className="label">{title}</h2>
      <ul className={`list-disc space-y-1 pl-5 text-sm ${tone}`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </section>
  );
}
