/**
 * Words clients use that mean different things to different people.
 * Each entry has a follow-up question with concrete options, so the client
 * can turn "modern" into something a developer can actually build.
 */
export const VAGUE_TERMS = [
  {
    term: 'modern',
    match: /\b(modern|sleek|trendy|up[- ]to[- ]date|contemporary)\b/i,
    question: 'People mean very different things by "modern". Which is closest to what you have in mind?',
    options: ['Big, bold photos', 'Minimal with lots of white space', 'Smooth animations', 'Dark theme', 'Like a specific site (I\'ll share it)'],
    multi: true,
  },
  {
    term: 'clean / simple',
    match: /\b(clean|simple|simpler|minimal|not messy|less cluttered)\b/i,
    question: 'When you say clean or simple, what should change?',
    options: ['Fewer items on each page', 'Fewer steps to buy', 'Clearer menu / navigation', 'Less text, more images', 'Bigger buttons and text'],
    multi: true,
  },
  {
    term: 'nice / attractive',
    match: /\b(nice|nicer|beautiful|attractive|eye[- ]catching|pretty|cool|premium|professional|look better|looks better)\b/i,
    question: 'What would make it look better to you?',
    options: ['Better photos', 'New colours / fonts', 'More consistent layout', 'Look more premium / high-end', 'Match our brand guidelines'],
    multi: true,
  },
  {
    term: 'user-friendly',
    match: /\b(user[- ]?friendly|easy to use|easier|intuitive|convenient|hassle[- ]free)\b/i,
    question: 'Easier for whom, and doing what? Pick the tasks that feel hard today.',
    options: ['Finding the right product', 'Checking out and paying', 'Tracking an order', 'Contacting us', 'Staff updating products/prices'],
    multi: true,
  },
  {
    term: 'fast',
    match: /\b(fast|faster|quick|quicker|speed|slow|lag|laggy)\b/i,
    question: 'Which kind of "fast" matters most?',
    options: ['Pages load quicker', 'Fewer clicks to finish a task', 'Faster for staff in the admin', 'Works well on slow mobile data'],
    multi: true,
  },
  {
    term: 'improve / enhance',
    match: /\b(improve|improvement|enhance|enhancement|upgrade|better|revamp|optimi[sz]e)\b/i,
    question: 'If this improvement worked perfectly, what would be different?',
    options: ['More customers buy', 'Staff spend less time on it', 'Fewer mistakes / complaints', 'It looks more trustworthy'],
    multi: true,
  },
  {
    term: 'like another site',
    match: /\b(like|similar to|same as|inspired by)\s+(?!to\b|this\b|that\b)([A-Z][\w.-]+|https?:\/\/\S+|www\.\S+)/,
    question: 'What exactly do you like about that site? Pick everything that applies.',
    options: ['The layout', 'The colours and style', 'A specific feature or animation', 'How easy it is to use', 'The photos'],
    multi: true,
  },
  {
    term: 'ASAP',
    match: /\b(asap|a\.s\.a\.p|urgent|urgently|as soon as possible|immediately|quickly as possible)\b/i,
    question: 'Is there a specific date behind "as soon as possible"?',
    options: ['A launch or event date', 'Customers are complaining now', 'Management wants it this month', 'No fixed date, just important'],
    multi: false,
  },
  {
    term: 'everything / etc.',
    match: /\b(everything|all the features|etc\.?|and so on|whatever is needed|the usual)\b/i,
    question: '"Everything" is hard to price and test. Which three things matter most?',
    options: [],
    multi: false,
  },
];

/** Returns the first vague term found in the text that hasn't been followed up yet. */
export function findVague(text, alreadyAsked = []) {
  if (!text) return null;
  for (const v of VAGUE_TERMS) {
    if (alreadyAsked.includes(v.term)) continue;
    const m = text.match(v.match);
    if (m) return { ...v, quote: m[0] };
  }
  return null;
}
