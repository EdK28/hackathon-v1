/**
 * Wireframes are plain data: screens made of blocks. The web app draws them as
 * grey-box layouts. Keeping them as data (not AI-written HTML) means they are
 * safe to render, look consistent, can be versioned and diffed, and either
 * engine can produce them.
 *
 * Block: { type, title, text, items: [string], note }
 *   note = why the block is there, linked to what the client said (shown as a numbered callout)
 */

export const BLOCK_TYPES = ['nav', 'hero', 'search', 'text', 'image', 'gallery', 'cards', 'list', 'form', 'table', 'chart', 'steps', 'buttons', 'banner', 'footer', 'floating'];

/** Shorten to whole words with an ellipsis. */
const clip = (t, n = 120) => (t.length <= n ? t : `${t.slice(0, n).replace(/\s+\S*$/, '').replace(/[.,;:!?]+$/, '')}…`);

const b = (type, title = '', { text = '', items = [], note = '' } = {}) => ({ type, title, text, items, note });

/** Normalise a wireframe from either engine: known block types only, sane sizes. */
export function cleanWireframe(wf) {
  const screens = (wf?.screens || []).slice(0, 6).map((s) => ({
    name: String(s.name || 'Screen').slice(0, 60),
    purpose: String(s.purpose || '').slice(0, 200),
    blocks: (s.blocks || []).slice(0, 14).map((x) => {
      const type = String(x.type || '').toLowerCase();
      return {
        type: BLOCK_TYPES.includes(type) ? type : 'text',
        title: String(x.title || '').slice(0, 80),
        text: String(x.text || '').slice(0, 200),
        items: (x.items || []).slice(0, 8).map((i) => String(i).slice(0, 60)),
        note: String(x.note || '').slice(0, 200),
      };
    }),
  }));
  return { device: wf?.device === 'desktop' ? 'desktop' : 'mobile', screens };
}

/** Rule-based wireframe built from the brief (offline engine). */
export function offlineWireframe({ template, fields, brief }) {
  const list = (k) => (fields[k] || '').split(/;|\(meaning:|\)/).map((s) => s.trim()).filter(Boolean);
  const has = (k, s) => (fields[k] || '').toLowerCase().includes(s.toLowerCase());
  const said = (term) => (brief.vague || []).find((v) => v.resolved && v.term === term);
  const problem = (fields.problem || '').toLowerCase();
  const must = list('mustHaves');
  const mobile = has('audience', 'mobile');

  // Which screens? The pages the client picked, else sensible defaults for the request type.
  let pages = list('pages').filter((p) => !/^not sure/i.test(p));
  if (!pages.length) pages = template.id === 'change' ? ['Affected page'] : ['Home page', ...(must.includes('Online payment') ? ['Cart & checkout'] : [])];
  if (must.includes('Admin dashboard / reports') && !pages.some((p) => /admin/i.test(p))) pages.push('Admin pages');

  const nav = b('nav', 'Header', { items: ['Logo', 'Menu', ...(must.includes('Product search') ? ['Search'] : []), ...(must.includes('Customer accounts & order history') ? ['Account'] : []), 'Cart'] });
  if (must.includes('Product search')) nav.note = 'Search is always visible in the header (must-have: product search).';
  const footer = b('footer', 'Footer', { items: ['Contact', 'FAQ', 'Policies', 'Social links'] });
  const wa = must.includes('WhatsApp contact') ? b('floating', 'WhatsApp button', { note: 'Must-have: WhatsApp contact from every page.' }) : null;

  const modern = said('modern');
  const heroNote = modern ? `You said “${modern.quote}” → ${modern.answer}.` : has('look', 'Bold, large photos') ? 'Look & feel: bold, large photos.' : '';

  const screens = pages.slice(0, 5).map((page) => {
    const p = page.toLowerCase();
    const blocks = [nav];
    if (p.includes('home')) {
      blocks.push(b('hero', 'Main banner', { text: fields.goal ? `Headline about: ${list('goal')[0]}` : 'Headline + short message', items: ['Primary button'], note: heroNote }));
      if (must.includes('Product search')) blocks.push(b('search', 'Search products', { text: 'Search by name or part number' }));
      blocks.push(b('cards', 'Featured products / categories', { items: ['Card', 'Card', 'Card', 'Card'] }));
      if (fields.references && !/no examples/i.test(fields.references)) blocks.push(b('banner', 'Section inspired by reference', { text: fields.references, note: `Reference the client gave: ${fields.references}` }));
    } else if (p.includes('listing')) {
      blocks.push(b('search', 'Search & filters', { items: ['Category', 'Model', 'Price'] }));
      blocks.push(b('cards', 'Product grid', { items: ['Product', 'Product', 'Product', 'Product', 'Product', 'Product'] }));
    } else if (p.includes('detail')) {
      blocks.push(b('gallery', 'Product photos', { items: ['Main photo', 'Thumb', 'Thumb', 'Thumb'] }));
      blocks.push(b('text', 'Name, part number, price, stock', { items: ['Name', 'Part no.', 'Price', 'In stock'] }));
      if (/fit|compatib|model|wrong bike|wrong part/.test(problem)) {
        blocks.push(b('list', 'Fits these models', { items: ['Model A', 'Model B', 'Model C'], note: `Solves the client's problem: “${clip(fields.problem || '')}”` }));
      }
      blocks.push(b('buttons', 'Actions', { items: ['Add to cart', ...(must.includes('WhatsApp contact') ? ['Ask on WhatsApp'] : [])] }));
      blocks.push(b('text', 'Description & specifications'));
    } else if (p.includes('checkout') || p.includes('cart')) {
      blocks.push(b('list', 'Items in cart', { items: ['Item × qty', 'Item × qty'] }));
      blocks.push(b('form', 'Delivery details', { items: ['Name', 'Phone', 'Address', 'Postcode', 'State'] }));
      blocks.push(b('buttons', 'Payment', { items: must.includes('Online payment') || has('integrations', 'Payment') ? ['FPX', 'Card', 'E-wallet'] : ['Pay'], note: must.includes('Online payment') ? 'Must-have: online payment.' : '' }));
      blocks.push(b('steps', 'Order progress', { items: ['Cart', 'Delivery', 'Payment', 'Done'] }));
    } else if (p.includes('account')) {
      blocks.push(b('table', 'My orders', { items: ['Order no.', 'Date', 'Status', 'Total'] }));
      blocks.push(b('form', 'Profile', { items: ['Name', 'Email', 'Phone'] }));
    } else if (p.includes('admin')) {
      blocks.push(b('chart', 'Sales over time', { note: must.includes('Admin dashboard / reports') ? 'Must-have: admin dashboard / reports.' : '' }));
      blocks.push(b('table', 'Recent orders', { items: ['Order', 'Customer', 'Status', 'Total'] }));
      blocks.push(b('buttons', 'Actions', { items: ['Export CSV', 'Filter by date'] }));
    } else {
      blocks.push(b('text', page, { text: fields.current || fields.problem || '', note: fields.current ? 'Where the reported issue happens.' : '' }));
    }
    if (must.includes('Booking or enquiry form') && p.includes('home')) blocks.push(b('form', 'Booking / enquiry', { items: ['Name', 'Phone', 'Date', 'Message'] }));
    blocks.push(footer);
    if (wa) blocks.push(wa);
    return { name: page, purpose: purposeFor(page, fields), blocks };
  });

  return cleanWireframe({ device: mobile ? 'mobile' : 'desktop', screens });
}

function purposeFor(page, fields) {
  const p = page.toLowerCase();
  if (p.includes('home')) return 'First impression: show what you sell and get visitors to the right product.';
  if (p.includes('detail')) return 'Help the customer decide this is the right part, then buy it.';
  if (p.includes('checkout') || p.includes('cart')) return 'Let the customer pay quickly and confidently.';
  if (p.includes('listing')) return 'Browse and narrow down products.';
  if (p.includes('account')) return 'Customers check their orders and details.';
  if (p.includes('admin')) return 'Staff see how the shop is doing and manage orders.';
  return fields.goal ? `Supports the goal: ${fields.goal}` : '';
}

/** JSON schema used for Claude's structured output. */
export const WIREFRAME_SCHEMA = {
  type: 'object',
  properties: {
    device: { type: 'string', enum: ['mobile', 'desktop'] },
    screens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          purpose: { type: 'string' },
          blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: BLOCK_TYPES },
                title: { type: 'string' },
                text: { type: 'string' },
                items: { type: 'array', items: { type: 'string' } },
                note: { type: 'string', description: 'Why this block exists, citing what the client said. Empty if obvious.' },
              },
              required: ['type', 'title', 'text', 'items', 'note'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'purpose', 'blocks'],
        additionalProperties: false,
      },
    },
  },
  required: ['device', 'screens'],
  additionalProperties: false,
};

/** Text outline for Markdown export. */
export function wireframeOutline(wf) {
  if (!wf?.screens?.length) return [];
  const lines = [];
  for (const s of wf.screens) {
    lines.push(`### ${s.name}`, s.purpose ? `_${s.purpose}_` : '', '');
    for (const x of s.blocks) {
      lines.push(`- **${x.title || x.type}** (${x.type})${x.items?.length ? `: ${x.items.join(', ')}` : ''}${x.note ? `  \n  ↳ ${x.note}` : ''}`);
    }
    lines.push('');
  }
  return lines;
}

/* ------------------------------------------------------------------------- */
/* Applying a client's change request to an existing wireframe (offline).    */
/* Handles the common requests: add a button / section / page, remove        */
/* something, move something above/below something else. Anything it can't   */
/* understand is passed to the developer instead of guessed.                 */
/* ------------------------------------------------------------------------- */

const STOP = new Set(['the', 'a', 'an', 'my', 'our', 'this', 'that', 'it', 'please', 'to', 'of', 'on', 'in', 'page', 'button', 'section', 'part', 'box', 'some']);
const words = (s) => String(s || '').toLowerCase().replace(/[^\w\s/&-]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
const titleCase = (s) => s.trim().replace(/\s+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()).replace(/\b(faq|sst|fpx|pdf|csv|whatsapp)\b/gi, (w) => ({ whatsapp: 'WhatsApp' })[w.toLowerCase()] || w.toUpperCase());
const stripQuotes = (s) => s.replace(/["“”'‘’]/g, '').trim();

/** Find the block (and item) that a phrase like "add to cart" or "the photos" refers to. */
function findTarget(wf, phrase, screenIdx = null) {
  const want = words(phrase);
  if (!want.length) return null;
  let best = null;
  wf.screens.forEach((s, si) => {
    if (screenIdx !== null && si !== screenIdx) return;
    s.blocks.forEach((blk, bi) => {
      const candidates = [{ text: blk.title, item: null }, ...(blk.items || []).map((it) => ({ text: it, item: it }))];
      for (const c of candidates) {
        const have = words(c.text);
        if (!have.length) continue;
        const hit = want.filter((w) => have.some((h) => h === w || (w.length > 3 && h.startsWith(w.slice(0, -1))))).length;
        const score = hit / Math.max(want.length, have.length) + (c.item ? 0.01 : 0);
        if (hit && score >= 0.5 && (!best || score > best.score)) best = { si, bi, item: c.item, score };
      }
    });
  });
  return best;
}

function findScreen(wf, text) {
  const t = text.toLowerCase();
  const i = wf.screens.findIndex((s) => words(s.name).some((w) => w.length > 3 && t.includes(w)));
  return i === -1 ? null : i;
}

const footerIndex = (s) => {
  const i = s.blocks.findIndex((x) => x.type === 'footer');
  return i === -1 ? s.blocks.length : i;
};

const SECTION_TYPES = { section: 'text', banner: 'banner', form: 'form', gallery: 'gallery', photos: 'gallery', list: 'list', table: 'table', chart: 'chart', video: 'image', map: 'image', image: 'image', reviews: 'cards', review: 'cards', testimonials: 'cards', faq: 'list', slider: 'hero', carousel: 'gallery', search: 'search', filter: 'search', filters: 'search' };

function applyOne(wf, sentence, quote) {
  const s = sentence.trim();
  const t = s.toLowerCase();
  if (!t) return null;
  const note = `You asked: “${clip(quote, 90)}”`;
  let m;

  // MOVE: "move/put the X above/below/at the top of Y"
  if ((m = t.match(/\b(?:move|put|place|show|have)\s+(?:the\s+)?(.+?)\s+(above|before|below|after|under|at the top|to the top|on top|at the bottom|to the bottom)(?:\s+of)?(?:\s+the)?\s*(.*)$/))) {
    const [, what, where, ref] = m;
    const a = findTarget(wf, what);
    if (a) {
      const screen = wf.screens[a.si];
      const [blk] = screen.blocks.splice(a.bi, 1);
      let at;
      if (/top/.test(where)) at = screen.blocks[0]?.type === 'nav' ? 1 : 0;
      else if (/bottom/.test(where)) at = footerIndex(screen);
      else {
        const b = findTarget(wf, ref, a.si);
        if (!b) { screen.blocks.splice(a.bi, 0, blk); return null; }
        at = /above|before/.test(where) ? b.bi : b.bi + 1;
      }
      screen.blocks.splice(at, 0, { ...blk, note });
      const place = /top|bottom/.test(where) ? `to the ${/top/.test(where) ? 'top' : 'bottom'}` : `${where} “${titleCase(ref)}”`;
      return `moved “${blk.title}” ${place} on the ${screen.name}`;
    }
  }

  // REMOVE: "remove / don't need / no X"
  if ((m = t.match(/\b(?:remove|delete|get rid of|take out|drop|hide|(?:i |we )?(?:don'?t|do not) (?:need|want)|no need for|not need)\s+(?:the\s+|a\s+|an\s+|any\s+)?(.+)$/))) {
    const what = m[1].replace(/\b(please|anymore|at all)\b/g, '').trim();
    // a whole page?
    if (/\bpages?\b|\bscreen\b/.test(what) && wf.screens.length > 1) {
      const si = findScreen(wf, what);
      if (si !== null) {
        const [gone] = wf.screens.splice(si, 1);
        return `removed the ${gone.name}`;
      }
    }
    const a = findTarget(wf, what);
    if (a) {
      const blk = wf.screens[a.si].blocks[a.bi];
      if (a.item && (blk.items || []).length > 1) {
        blk.items = blk.items.filter((x) => x !== a.item);
        return `removed “${a.item}” from ${blk.title}`;
      }
      wf.screens[a.si].blocks.splice(a.bi, 1);
      return `removed “${blk.title}” from the ${wf.screens[a.si].name}`;
    }
  }

  // ADD PAGE: "add a contact page"
  if ((m = t.match(/\b(?:add|need|want|include|create|have)\s+(?:(?:a|an|another|one more)\s+)?(?:new\s+)?(.{2,40}?)\s+page\b/))) {
    const name = `${titleCase(stripQuotes(m[1]))} page`;
    if (!wf.screens.some((x) => x.name.toLowerCase() === name.toLowerCase()) && wf.screens.length < 6) {
      const nav = wf.screens[0]?.blocks.find((x) => x.type === 'nav') || b('nav', 'Header', { items: ['Logo', 'Menu'] });
      const footer = wf.screens[0]?.blocks.find((x) => x.type === 'footer') || b('footer', 'Footer', { items: ['Contact'] });
      wf.screens.push({ name, purpose: note, blocks: [nav, b('text', name, { note }), footer] });
      return `added a ${name}`;
    }
  }

  // ADD BUTTON: "add a compare button next to add to cart"
  if ((m = t.match(/\b(?:add|put|include|need|want|have|place)\s+(?:(?:a|an|another|one more|the|one|some|new)\s+)*(?:["“']?(.{1,40}?)["”']?\s+)?buttons?\b(?:\s+(?:next to|beside|near|by|with|under|below|above|after|before|on|in)\s+(?:the\s+)?(.+))?/))) {
    const raw = stripQuotes(m[1] || '').replace(/^(another|new|extra|more)\b\s*/i, '');
    let label = raw ? titleCase(raw) : 'New button';
    const taken = new Set(wf.screens.flatMap((x) => x.blocks).flatMap((x) => x.items || []));
    for (let n = 2; taken.has(label); n++) label = `${label.replace(/ \d+$/, '')} ${n}`;
    const anchor = m[2] ? findTarget(wf, m[2]) : null;
    const what = /^New button/.test(label) ? `a new button (“${label}”)` : `a “${label}” button`;
    if (anchor) {
      const screen = wf.screens[anchor.si];
      const blk = screen.blocks[anchor.bi];
      if (blk.type === 'buttons' || blk.type === 'nav') {
        const items = [...(blk.items || [])];
        const pos = anchor.item ? items.indexOf(anchor.item) + 1 : items.length;
        items.splice(pos, 0, label);
        screen.blocks[anchor.bi] = { ...blk, items, note };
        return `added ${what} next to “${anchor.item || blk.title}” on the ${screen.name}`;
      }
      screen.blocks.splice(anchor.bi + 1, 0, b('buttons', `${label} button`, { items: [label], note }));
      return `added ${what} under “${blk.title}” on the ${screen.name}`;
    }
    const si = findScreen(wf, t) ?? 0;
    const screen = wf.screens[si];
    const existing = screen.blocks.findIndex((x) => x.type === 'buttons');
    if (existing !== -1) {
      const blk = screen.blocks[existing];
      screen.blocks[existing] = { ...blk, items: [...(blk.items || []), label], note };
      return `added ${what} to ${blk.title} on the ${screen.name}`;
    }
    screen.blocks.splice(footerIndex(screen), 0, b('buttons', `${label} button`, { items: [label], note }));
    return `added ${what} on the ${screen.name}`;
  }

  // ADD SECTION: "add a reviews section below the photos"
  const kinds = Object.keys(SECTION_TYPES).join('|');
  if ((m = t.match(new RegExp(`\\b(?:add|put|include|need|want|have|show)\\s+(?:(?:a|an|another|some|the|new)\\s+)*(.{0,40}?)\\s*\\b(${kinds})\\b(?:\\s+section)?(?:\\s+(above|before|below|after|under|next to|at the top|at the bottom)(?:\\s+of)?\\s*(?:the\\s+)?(.*))?`)))) {
    const [, label, kind, where, ref] = m;
    const type = SECTION_TYPES[kind];
    const title = titleCase(stripQuotes(`${label} ${kind === 'section' ? '' : kind}`).trim() || kind);
    let si = findScreen(wf, t) ?? 0;
    let at = null;
    if (where && /top/.test(where)) at = wf.screens[si].blocks[0]?.type === 'nav' ? 1 : 0;
    else if (where && ref && !/bottom/.test(where)) {
      const anchor = findTarget(wf, ref);
      if (anchor) { si = anchor.si; at = /above|before/.test(where) ? anchor.bi : anchor.bi + 1; }
    }
    const screen = wf.screens[si];
    if (at === null) at = footerIndex(screen);
    const items = type === 'list' ? ['Item', 'Item', 'Item'] : type === 'form' ? ['Name', 'Phone', 'Message'] : [];
    screen.blocks.splice(at, 0, b(type, title, { items, note }));
    return `added a “${title}” section on the ${screen.name}`;
  }
  return null;
}

/** Returns { applied, reply, wireframe }. Never throws on odd input. */
export function offlineReviseWireframe(wireframe, request) {
  const wf = JSON.parse(JSON.stringify(wireframe || { screens: [] }));
  if (!wf.screens?.length) return { applied: false, reply: '', wireframe };
  const parts = String(request)
    .split(/(?:[.!?\n;]+|\band also\b|\balso\b|,?\s+and then\b|,\s*and\b)/i)
    .map((x) => x.trim())
    .filter(Boolean);
  const done = [];
  for (const p of parts) {
    try {
      const r = applyOne(wf, p, request);
      if (r) done.push(r);
    } catch {
      /* ignore a sentence we can't apply */
    }
  }
  if (!done.length) return { applied: false, reply: '', wireframe };
  const list = done.length === 1 ? done[0] : `${done.slice(0, -1).join('; ')} and ${done.at(-1)}`;
  return { applied: true, reply: `Done, I've updated the sketch: ${list}.`, wireframe: cleanWireframe(wf) };
}

/** Claude structured-output schema for a revision. */
export const REVISION_SCHEMA = {
  type: 'object',
  properties: {
    applied: { type: 'boolean', description: 'true if the request was a layout change you applied; false if it is unclear or not about the layout' },
    reply: { type: 'string', description: 'One or two friendly sentences to the client saying exactly what changed (or, if not applied, empty).' },
    wireframe: WIREFRAME_SCHEMA,
  },
  required: ['applied', 'reply', 'wireframe'],
  additionalProperties: false,
};
