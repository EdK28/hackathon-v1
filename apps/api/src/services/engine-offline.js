/**
 * Offline brief engine: rule-based, no API key needed. Used for demos, tests,
 * and as a fallback if the Claude API is unavailable. It walks the template
 * checklist, follows up on vague words, asks for examples when an answer is
 * too thin, and flags contradictions and assumptions.
 */
import { findVague, VAGUE_TERMS } from './vague.js';
import { offlineReviseWireframe, offlineWireframe } from './wireframe.js';

const UNSURE = /\b(not sure|don'?t know|no idea|tak pasti|unsure|tbc|to be confirmed|not sure yet)\b/i;
const FREE_TEXT_MIN_WORDS = 6;

export const answerText = (a) => [...(a.selected || []), a.other].map((s) => (s || '').trim()).filter(Boolean).join('; ');

const short = (s, n = 90) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const q = (text, options = [], multi = false) => ({ text, options, multi });

function nextField(template, fields) {
  return template.fields.find((f) => !fields[f.key]);
}

function askField(f) {
  return { question: q(f.question, f.options, f.multi), pending: { kind: 'field', field: f.key } };
}

/** Rules that spot answers which don't fit together. */
function checkContradictions(fields) {
  const out = [];
  const has = (k, s) => (fields[k] || '').toLowerCase().includes(s.toLowerCase());
  const count = (k) => (fields[k] ? fields[k].split(';').filter((x) => x.trim()).length : 0);
  if (count('mustHaves') >= 5 && has('deadline', '2 weeks')) {
    out.push(`${count('mustHaves')} must-have features with a deadline within 2 weeks is unlikely to fit. Agree which to deliver first.`);
  }
  if (has('budget', 'Under RM 5,000') && (count('mustHaves') >= 4 || count('integrations') >= 2)) {
    out.push('The budget (under RM 5,000) looks small for the number of features and integrations requested.');
  }
  if (has('look', 'Keep our current brand colours') && (has('look', 'Dark theme') || has('look', 'Fun and colourful'))) {
    out.push('Asked to keep the current brand colours but also for a dark / colourful theme. Confirm which wins.');
  }
  for (const item of ['Multi-language', 'Customer accounts']) {
    if (has('outOfScope', item) && has('mustHaves', item)) out.push(`"${item}" is listed as both a must-have and not needed.`);
  }
  if (has('goal', 'Reduce manual work') && has('audience', 'Retail customers') && !has('audience', 'staff')) {
    out.push('Goal is to reduce staff work, but staff are not listed as users. Check whether admin screens are in scope.');
  }
  return out;
}

function checkAssumptions(fields) {
  const out = [];
  const has = (k, s) => (fields[k] || '').toLowerCase().includes(s.toLowerCase());
  if (has('references', 'No examples')) out.push('No reference sites given: the designer will propose 2 directions for the client to choose from.');
  if (has('content', 'Please create them')) out.push('Writing text and producing photos are extra work and need to be quoted separately.');
  if (has('content', 'stock photos')) out.push('Stock photos must be licensed for commercial use; licence cost not included.');
  if (has('integrations', 'MyInvois')) out.push('E-invoice integration requires the client\'s MyInvois credentials and tax details.');
  return out;
}

export const offlineEngine = {
  name: 'offline',

  async start({ template, clientName, developerName, initialRequest }) {
    const fields = {};
    const queue = [];
    const vague = [];
    let intro = `Hi ${clientName}! I'll ask a few quick questions so ${developerName || 'the team'} knows exactly what you need. Tap an option or type your own answer. It takes about 5 minutes.`;
    if (initialRequest) {
      intro += `\n\nYou wrote: “${short(initialRequest, 160)}”`;
      // Queue follow-ups for every vague word in the original request
      const asked = [];
      let v;
      while ((v = findVague(initialRequest, asked))) {
        asked.push(v.term);
        queue.push(v.term);
        vague.push({ term: v.term, quote: v.quote, field: 'initialRequest', resolved: false });
      }
    }
    const first = template.fields[0];
    return { reply: intro, ...askField(first), pending: { kind: 'field', field: first.key, queue }, fields, vague, done: false };
  },

  async turn({ template, fields: prevFields, pending, brief, answer }) {
    const fields = { ...prevFields };
    const vague = (brief.vague || []).map((v) => ({ ...v }));
    const openQuestions = [...(brief.openQuestions || [])];
    const text = answerText(answer);
    const queue = [...(pending.queue || [])];
    const fieldDef = template.fields.find((f) => f.key === pending.field);
    let reply = '';

    // 1. Store the answer
    if (pending.kind === 'field' && fieldDef) {
      if (UNSURE.test(text)) {
        fields[fieldDef.key] = 'Not sure yet (to discuss)';
        openQuestions.push(`${fieldDef.label}: client is not sure yet.`);
        reply = "No problem, I've noted it as something to discuss.";
      } else {
        fields[fieldDef.key] = text;
        reply = `Got it: ${short(text)}.`;
        // Thin free-text answer: ask once for a concrete example
        if (!fieldDef.options.length && text.split(/\s+/).length < FREE_TEXT_MIN_WORDS) {
          return {
            reply: `Thanks. Could you add a bit more detail? A real example helps the developer most. For instance: which page, what you clicked, what happened, and how often.`,
            question: q('Can you describe a real example?', []),
            pending: { kind: 'detail', field: fieldDef.key, queue },
            fields, vague, openQuestions,
            contradictions: checkContradictions(fields), assumptions: checkAssumptions(fields), done: false,
          };
        }
        // Vague word in the answer: follow up before moving on. A reference site
        // on its own is always vague ("like Shopee"), so ask what they like about it.
        const asked = vague.map((v) => v.term);
        let v = findVague(answer.other || '', asked);
        if (!v && fieldDef.key === 'references' && (answer.other || '').trim() && !asked.includes('like another site')) {
          v = { ...VAGUE_TERMS.find((x) => x.term === 'like another site'), quote: answer.other.trim() };
        }
        if (v) {
          vague.push({ term: v.term, quote: v.quote, field: fieldDef.key, resolved: false });
          return {
            reply: `Got it. You said “${v.quote}”: ${v.question}`,
            question: q(v.question, v.options, v.multi),
            pending: { kind: 'followup', field: fieldDef.key, term: v.term, queue },
            fields, vague, openQuestions,
            contradictions: checkContradictions(fields), assumptions: checkAssumptions(fields), done: false,
          };
        }
      }
    } else if (pending.kind === 'detail' && fieldDef) {
      fields[fieldDef.key] = `${fields[fieldDef.key]}. ${text}`;
      reply = 'Thanks, that example helps a lot.';
    } else if (pending.kind === 'followup') {
      const entry = vague.find((v) => v.term === pending.term && !v.resolved);
      if (entry) {
        entry.answer = text;
        entry.resolved = true;
      }
      if (fieldDef) fields[fieldDef.key] = `${fields[fieldDef.key]} (meaning: ${text})`;
      reply = `Thanks, that's much clearer: ${short(text)}.`;
    }

    // 2. Ask about vague words from the original request (after the first answer)
    if (queue.length) {
      const term = queue.shift();
      const v = VAGUE_TERMS.find((x) => x.term === term);
      const entry = vague.find((x) => x.term === term && x.field === 'initialRequest');
      return {
        reply: `${reply}\n\nIn your first message you said “${entry?.quote || term}”. ${v.question}`,
        question: q(v.question, v.options, v.multi),
        pending: { kind: 'followup', field: null, term, queue },
        fields, vague, openQuestions,
        contradictions: checkContradictions(fields), assumptions: checkAssumptions(fields), done: false,
      };
    }

    // 3. Next unanswered field, or finish
    const next = nextField(template, fields);
    const base = { fields, vague, openQuestions, contradictions: checkContradictions(fields), assumptions: checkAssumptions(fields) };
    if (!next) {
      return {
        ...base,
        reply: `${reply}\n\nThat's everything I need, thank you! I'll put this into a short brief for the team to review. You'll get a link to check and approve it.`,
        question: null,
        pending: { kind: 'done', queue: [] },
        done: true,
      };
    }
    const asked = askField(next);
    return { ...base, reply, question: asked.question, pending: { ...asked.pending, queue }, done: false };
  },

  async finalize({ template, fields, brief }) {
    const list = (k) => (fields[k] || '').split(';').map((x) => x.trim()).filter(Boolean);
    const sentence = (x) => x.replace(/[.\s]+$/, '');
    const singular = (a) => a.replace(/\b(customers|users|dealers)\b/i, (w) => w.slice(0, -1)).replace(/mostly$/i, '').trim().toLowerCase();
    const who = singular(list('audience')[0] || 'customer');

    const GOAL = {
      'Get more sales or orders online': 'more customers complete their order online',
      'Reduce manual work for staff': 'staff spend less time on manual work',
      'Look more professional / trustworthy': 'customers trust the business more',
      'Collect more leads or enquiries': 'the business receives more enquiries',
      'Fix something that is broken': 'the problem stops happening',
    };
    const soThat = GOAL[list('goal')[0]] || (list('goal')[0] ? sentence(list('goal')[0]).toLowerCase() : 'the project goal is met');

    const FEATURE = {
      'Online payment': ['to pay online at checkout', ['Customer can pay by FPX and card at checkout', 'Order is marked paid automatically when payment succeeds', 'A failed payment can be retried from the order page']],
      'Product search': ['to search for products by name or part number', ['Searching a part number or name returns matching products', 'Searches with no results suggest alternatives']],
      'Customer accounts & order history': ['to log in and see my past orders', ['Customer can register, log in and reset their password', 'Customer sees past orders and their status']],
      'Admin dashboard / reports': ['(as staff) to see sales reports', ['Admin sees sales for a chosen date range', 'Report downloads as CSV with correct totals']],
      'WhatsApp contact': ['to contact the shop on WhatsApp from any page', ['A WhatsApp button is visible on every page', 'It opens a chat with the business number']],
      'Multi-language (BM/EN)': ['to use the site in Bahasa Malaysia or English', ['Every customer page can switch between BM and English']],
      'Booking or enquiry form': ['to send a booking or enquiry', ['Submissions are saved and staff are notified', 'Customer sees a confirmation message']],
    };

    const stories = [];
    if (fields.problem && !/^not sure/i.test(fields.problem)) {
      stories.push({
        asA: who,
        iWant: `this problem solved: "${sentence(fields.problem)}"`,
        soThat,
        acceptance: [
          'The real example the client gave no longer happens on the test site',
          ...(list('success').length ? [`Success is measured by: ${list('success').join(', ')}`] : []),
        ],
      });
    }
    const items = template.id === 'change' ? [] : list('mustHaves').length ? list('mustHaves') : list('pages');
    for (const item of items.slice(0, 7)) {
      const [want, acceptance] = FEATURE[item] || [`"${item}" to be improved`, [`"${item}" works on desktop and mobile`, 'Client has approved it on the test site']];
      stories.push({ asA: who, iWant: want, soThat, acceptance });
    }

    const summary = [
      `${template.name} for ${(fields.audience || "the client's users").replace(/;/g, ',')}`,
      fields.goal && `Goal: ${sentence(fields.goal).replace(/;/g, ',')}`,
      fields.problem && `Problem today: ${sentence(fields.problem)}`,
      fields.deadline && `Timing: ${sentence(fields.deadline)}`,
    ].filter(Boolean).map((x) => sentence(x) + '.').join(' ');

    const risks = [...(brief.contradictions || []), ...(brief.openQuestions || []).map((o) => `Open: ${o}`)];
    if ((brief.vague || []).some((v) => !v.resolved)) risks.push('Some vague terms were not clarified.');
    return { summary, stories, risks };
  },

  async wireframe({ template, fields, brief }) {
    return offlineWireframe({ template, fields, brief });
  },

  async reviseWireframe({ brief, request }) {
    return offlineReviseWireframe(brief.wireframe, request);
  },
};
