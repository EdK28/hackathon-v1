'use client';

import { useState } from 'react';

/**
 * Draws a low-fidelity wireframe (grey boxes, no styling) from the brief's
 * wireframe data. Numbered markers link blocks to notes explaining why they exist.
 */
export function Wireframe({ wireframe }) {
  const screens = wireframe?.screens || [];
  const [i, setI] = useState(0);
  const [device, setDevice] = useState(wireframe?.device || 'mobile');
  if (!screens.length) return <p className="text-sm text-mute">No wireframe yet.</p>;
  const screen = screens[Math.min(i, screens.length - 1)];
  const mobile = device === 'mobile';
  const hasFloating = screen.blocks.some((b) => b.type === 'floating');

  // Number the blocks that have notes, in order
  let n = 0;
  const numbered = screen.blocks.map((b) => ({ ...b, n: b.note ? ++n : null }));
  const notes = numbered.filter((b) => b.note);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Screens">
          {screens.map((s, k) => (
            <button
              key={s.name + k}
              role="tab"
              aria-selected={k === i}
              onClick={() => setI(k)}
              className={`rounded-full px-3 py-1 text-sm ${k === i ? 'bg-ink text-white' : 'bg-white text-ink-2 ring-1 ring-line hover:ring-ink'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex rounded-full bg-white p-0.5 text-xs ring-1 ring-line" role="group" aria-label="Preview size">
          {['mobile', 'desktop'].map((d) => (
            <button key={d} onClick={() => setDevice(d)} aria-pressed={device === d} className={`rounded-full px-3 py-1 capitalize ${device === d ? 'bg-ink text-white' : 'text-mute'}`}>
              {d === 'mobile' ? '📱 Phone' : '🖥 Desktop'}
            </button>
          ))}
        </div>
      </div>
      {screen.purpose && <p className="mb-3 text-sm text-mute">{screen.purpose}</p>}

      <div className={`grid gap-6 ${notes.length && mobile ? 'lg:grid-cols-[auto_1fr]' : ''}`}>
        <div className={`relative mx-auto w-full overflow-hidden border-2 border-ink/70 bg-white ${mobile ? 'max-w-190 rounded-[28px] px-3 pt-5' : 'max-w-190 rounded-lg'} ${hasFloating ? 'pb-16' : mobile ? 'pb-6' : 'pb-4'}`}>
          {mobile ? (
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-ink/20" aria-hidden="true" />
          ) : (
            <div className="mb-3 flex items-center gap-1.5 border-b-2 border-ink/10 px-3 py-2" aria-hidden="true">
              {[0, 1, 2].map((d) => <span key={d} className="h-2.5 w-2.5 rounded-full bg-ink/15" />)}
              <span className="ml-3 h-4 flex-1 rounded bg-ink/5" />
            </div>
          )}
          <div className={`space-y-3 ${mobile ? '' : 'px-4'}`}>
            {numbered.filter((b) => b.type !== 'floating').map((b, k) => (
              <Block key={k} b={b} mobile={mobile} />
            ))}
          </div>
          {numbered.filter((b) => b.type === 'floating').map((b, k) => (
            <div key={k} className="absolute bottom-4 right-4 flex items-center gap-1">
              {b.n && <Marker n={b.n} />}
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-ink/50 bg-white text-[9px] font-semibold leading-tight text-ink/70" title={b.title}>
                {b.title.split(' ')[0]}
              </div>
            </div>
          ))}
        </div>

        {notes.length > 0 && (
          <ol className={`space-y-2 text-sm ${mobile ? 'lg:max-w-xs' : 'mx-auto w-full max-w-190'}`}>
            <li className="label">Why these parts are here</li>
            {notes.map((b) => (
              <li key={b.n} className="flex gap-2">
                <Marker n={b.n} />
                <span><b>{b.title}:</b> {b.note}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-mute">Rough layout only. Colours, photos and wording come later in the design.</p>
    </div>
  );
}

function Marker({ n }) {
  return <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">{n}</span>;
}

const Line = ({ w = 'w-full', h = 'h-2' }) => <span className={`block rounded bg-ink/12 ${w} ${h}`} />;
const Box = ({ className = '', children }) => <div className={`rounded border-2 border-dashed border-ink/25 ${className}`}>{children}</div>;
const ImageBox = ({ className = '' }) => (
  <div className={`relative overflow-hidden rounded border-2 border-ink/20 bg-ink/3 ${className}`} aria-hidden="true">
    <svg className="absolute inset-0 h-full w-full text-ink/15" preserveAspectRatio="none" viewBox="0 0 100 100">
      <path d="M0 0L100 100M100 0L0 100" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
);
const Label = ({ children }) => <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/55">{children}</span>;

function Block({ b, mobile }) {
  const head = (
    <div className="mb-1.5 flex items-center gap-1.5">
      {b.n && <Marker n={b.n} />}
      <Label>{b.title}</Label>
    </div>
  );
  const items = b.items || [];

  switch (b.type) {
    case 'nav':
      return (
        <div className="flex items-center gap-2 border-b-2 border-ink/10 pb-2">
          {b.n && <Marker n={b.n} />}
          <span className="h-5 w-14 rounded bg-ink/25" aria-hidden="true" />
          <div className="ml-auto flex flex-wrap justify-end gap-1">
            {items.filter((x) => x !== 'Logo').map((x, k) => (
              <span key={k} className="rounded border border-ink/20 px-1.5 py-0.5 text-[10px] text-ink/60">{x}</span>
            ))}
          </div>
        </div>
      );
    case 'hero':
      return (
        <div>
          {head}
          <div className={`grid gap-3 rounded border-2 border-ink/20 p-3 ${mobile ? '' : 'grid-cols-[1fr_1.2fr] items-center'}`}>
            <div className="space-y-2">
              <Line w="w-11/12" h="h-3.5" />
              <Line w="w-8/12" h="h-3.5" />
              {b.text && <p className="text-[11px] text-ink/50">{b.text}</p>}
              <span className="inline-block rounded bg-ink/70 px-3 py-1 text-[10px] font-semibold text-white">{items[0] || 'Button'}</span>
            </div>
            <ImageBox className={mobile ? 'h-28' : 'h-36'} />
          </div>
        </div>
      );
    case 'search':
      return (
        <div>
          {head}
          <div className="flex items-center gap-2 rounded-full border-2 border-ink/25 px-3 py-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-ink/40" aria-hidden="true" />
            <span className="text-[11px] text-ink/45">{b.text || 'Search…'}</span>
          </div>
          {items.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {items.map((x, k) => <span key={k} className="rounded border border-ink/20 px-1.5 py-0.5 text-[10px] text-ink/60">{x} ▾</span>)}
            </div>
          )}
        </div>
      );
    case 'image':
      return <div>{head}<ImageBox className="h-32" /></div>;
    case 'gallery':
      return (
        <div>
          {head}
          <ImageBox className="h-36" />
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">{[0, 1, 2, 3].map((k) => <ImageBox key={k} className="h-9" />)}</div>
        </div>
      );
    case 'cards': {
      const count = Math.max(2, Math.min(items.length || 4, mobile ? 4 : 6));
      return (
        <div>
          {head}
          <div className={`grid gap-2 ${mobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
            {Array.from({ length: count }).map((_, k) => (
              <div key={k} className="space-y-1.5 rounded border-2 border-ink/15 p-1.5">
                <ImageBox className="h-12" />
                <Line w="w-10/12" />
                <Line w="w-5/12" />
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'list':
      return (
        <div>
          {head}
          <Box className="divide-y-2 divide-dashed divide-ink/15">
            {(items.length ? items : ['Item', 'Item', 'Item']).map((x, k) => (
              <div key={k} className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-ink/60">
                <span className="h-2 w-2 rounded-full bg-ink/30" aria-hidden="true" />
                {x}
              </div>
            ))}
          </Box>
        </div>
      );
    case 'form':
      return (
        <div>
          {head}
          <div className={`grid gap-2 ${mobile ? '' : 'grid-cols-2'}`}>
            {(items.length ? items : ['Field', 'Field']).map((x, k) => (
              <div key={k}>
                <span className="text-[10px] text-ink/50">{x}</span>
                <span className="mt-0.5 block h-6 rounded border-2 border-ink/20" aria-hidden="true" />
              </div>
            ))}
          </div>
          <span className="mt-2 inline-block rounded bg-ink/70 px-3 py-1 text-[10px] font-semibold text-white">Submit</span>
        </div>
      );
    case 'table':
      return (
        <div>
          {head}
          <div className="overflow-hidden rounded border-2 border-ink/20 text-[10px]">
            <div className="grid bg-ink/5" style={{ gridTemplateColumns: `repeat(${Math.max(1, items.length)}, 1fr)` }}>
              {(items.length ? items : ['Column']).map((x, k) => <span key={k} className="truncate px-1.5 py-1 font-semibold text-ink/60">{x}</span>)}
            </div>
            {[0, 1, 2].map((r) => (
              <div key={r} className="grid border-t border-ink/10" style={{ gridTemplateColumns: `repeat(${Math.max(1, items.length)}, 1fr)` }}>
                {(items.length ? items : [0]).map((_, c) => <span key={c} className="px-1.5 py-1.5"><Line w="w-9/12" h="h-1.5" /></span>)}
              </div>
            ))}
          </div>
        </div>
      );
    case 'chart':
      return (
        <div>
          {head}
          <Box className="flex h-24 items-end gap-1.5 p-2">
            {[40, 65, 50, 80, 60, 90, 70].map((h, k) => <span key={k} className="flex-1 rounded-t bg-ink/20" style={{ height: `${h}%` }} />)}
          </Box>
        </div>
      );
    case 'steps':
      return (
        <div>
          {head}
          <div className="flex items-center">
            {(items.length ? items : ['Step', 'Step', 'Step']).map((x, k, arr) => (
              <div key={k} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink/40 text-[9px] text-ink/60">{k + 1}</span>
                  <span className="text-[9px] text-ink/55">{x}</span>
                </div>
                {k < arr.length - 1 && <span className="mx-1 h-0.5 flex-1 bg-ink/15" />}
              </div>
            ))}
          </div>
        </div>
      );
    case 'buttons':
      return (
        <div>
          {head}
          <div className="flex flex-wrap gap-1.5">
            {(items.length ? items : ['Button']).map((x, k) => (
              <span key={k} className={`rounded px-3 py-1.5 text-[11px] font-semibold ${k === 0 ? 'bg-ink/70 text-white' : 'border-2 border-ink/30 text-ink/70'}`}>{x}</span>
            ))}
          </div>
        </div>
      );
    case 'banner':
      return (
        <div>
          {head}
          <Box className="flex items-center gap-3 bg-ink/3 p-3">
            <ImageBox className="h-12 w-16 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Line w="w-9/12" h="h-2.5" />
              {b.text ? <p className="text-[10px] text-ink/50">{b.text}</p> : <Line w="w-6/12" />}
            </div>
          </Box>
        </div>
      );
    case 'footer':
      return (
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 rounded bg-ink/6
         p-2.5">
          {b.n && <Marker n={b.n} />}
          {(items.length ? items : ['Links']).map((x, k) => <span key={k} className="text-[10px] text-ink/50">{x}</span>)}
        </div>
      );
    default: // text
      return (
        <div>
          {head}
          <div className="space-y-1.5">
            {items.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">{items.map((x, k) => <span key={k} className="rounded bg-ink/6 px-1.5 py-0.5 text-[10px] text-ink/60">{x}</span>)}</div>
            ) : (
              <>
                <Line />
                <Line w="w-11/12" />
                <Line w="w-7/12" />
              </>
            )}
            {b.text && <p className="text-[11px] text-ink/50">{b.text}</p>}
          </div>
        </div>
      );
  }
}
