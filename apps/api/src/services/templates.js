/**
 * Brief templates for web projects. Each field is one thing a complete brief
 * needs. `question` + `options` are what the client sees (options make it
 * easy for non-technical clients to answer; they can always add their own).
 * `hint` tells the AI what a good answer looks like.
 */

const F = {
  goal: {
    key: 'goal',
    label: 'Goal',
    question: 'What is the main thing you want this project to achieve for your business?',
    options: ['Get more sales or orders online', 'Reduce manual work for staff', 'Look more professional / trustworthy', 'Collect more leads or enquiries', 'Fix something that is broken'],
    multi: true,
    hint: 'A business outcome, not a feature. Ideally measurable.',
  },
  audience: {
    key: 'audience',
    label: 'Who will use it',
    question: 'Who will mainly use this?',
    options: ['Retail customers', 'Dealers / trade customers', 'Your own staff (admin)', 'Mobile phone users mostly', 'Desktop users mostly'],
    multi: true,
    hint: 'Primary user groups and the device they mostly use.',
  },
  problem: {
    key: 'problem',
    label: 'Current problem',
    question: 'What is not working well today? A real example helps a lot.',
    options: [],
    multi: false,
    hint: 'A concrete current pain, ideally with an example or numbers.',
  },
  mustHaves: {
    key: 'mustHaves',
    label: 'Must-haves',
    question: 'Which of these must it do? Pick only what is essential for the first version.',
    options: ['Online payment', 'Product search', 'Customer accounts & order history', 'Admin dashboard / reports', 'WhatsApp contact', 'Multi-language (BM/EN)', 'Booking or enquiry form'],
    multi: true,
    hint: 'The essential features for version 1, each specific enough to test.',
  },
  pages: {
    key: 'pages',
    label: 'Pages / screens affected',
    question: 'Which pages or screens does this change?',
    options: ['Home page', 'Product / listing pages', 'Product detail page', 'Cart & checkout', 'Account pages', 'Admin pages'],
    multi: true,
    hint: 'Where in the site/app the work happens.',
  },
  references: {
    key: 'references',
    label: 'Examples & inspiration',
    question: 'Is there a website or app you like that we should look at? Paste the link and tell us what you like about it.',
    options: ['No examples', "I'll send screenshots"],
    multi: false,
    hint: 'A link PLUS which specific part (layout, colours, a feature, the wording) they like.',
  },
  look: {
    key: 'look',
    label: 'Look & feel',
    question: 'How should it look and feel?',
    options: ['Keep our current brand colours', 'Bold, large photos', 'Minimal with lots of white space', 'Dark theme', 'Fun and colourful'],
    multi: true,
    hint: 'Concrete visual direction, not adjectives like "modern".',
  },
  content: {
    key: 'content',
    label: 'Content & images',
    question: 'Who will provide the text and photos?',
    options: ['We have everything ready', 'We have some, need help with the rest', 'Please create them for us', 'Use stock photos'],
    multi: false,
    hint: 'Who supplies copy/images and whether they own the rights.',
  },
  integrations: {
    key: 'integrations',
    label: 'Systems to connect',
    question: 'Does it need to connect to anything you already use?',
    options: ['Payment gateway (e.g. FPX)', 'Courier / shipping', 'Accounting or e-invoice (MyInvois)', 'CRM or dealer system', 'Google Sheets / Excel', 'Nothing else'],
    multi: true,
    hint: 'External systems and data flows.',
  },
  current: {
    key: 'current',
    label: 'What happens now',
    question: 'Describe exactly what happens now, step by step, and what you expected instead.',
    options: [],
    multi: false,
    hint: 'Steps to reproduce, actual vs expected result, which page and device.',
  },
  deadline: {
    key: 'deadline',
    label: 'Deadline',
    question: 'When do you need it, and is that date fixed?',
    options: ['Within 2 weeks', 'Within a month', 'In 1–3 months', 'No fixed date', 'Fixed date (event/launch)'],
    multi: false,
    hint: 'A date or range and whether it is fixed and why.',
  },
  budget: {
    key: 'budget',
    label: 'Budget',
    question: 'Do you have a budget range in mind?',
    options: ['Under RM 5,000', 'RM 5,000 – 15,000', 'RM 15,000 – 50,000', 'Above RM 50,000', 'Not sure yet'],
    multi: false,
    hint: 'A range is enough.',
  },
  success: {
    key: 'success',
    label: 'How we know it worked',
    question: 'Three months after launch, what would make you say "this worked"?',
    options: ['More online orders', 'Fewer WhatsApp/phone enquiries', 'Staff save time each week', 'Fewer complaints or errors', 'Customers say it is easier'],
    multi: true,
    hint: 'Measurable success criteria with a number if possible.',
  },
  outOfScope: {
    key: 'outOfScope',
    label: 'Not included',
    question: 'Is there anything you definitely do NOT need right now?',
    options: ['Mobile app', 'Multi-language', 'Customer accounts', 'Nothing comes to mind'],
    multi: true,
    hint: 'Explicit exclusions; reduces later disputes.',
  },
};

const pick = (...keys) => keys.map((k) => F[k]);

export const TEMPLATES = {
  feature: {
    id: 'feature',
    name: 'New feature on an existing website',
    fields: pick('goal', 'audience', 'problem', 'pages', 'mustHaves', 'references', 'content', 'integrations', 'deadline', 'success', 'outOfScope'),
  },
  redesign: {
    id: 'redesign',
    name: 'Website redesign / UI refresh',
    fields: pick('goal', 'audience', 'problem', 'pages', 'references', 'look', 'content', 'deadline', 'budget', 'success', 'outOfScope'),
  },
  'new-site': {
    id: 'new-site',
    name: 'New website or web app',
    fields: pick('goal', 'audience', 'problem', 'mustHaves', 'references', 'look', 'content', 'integrations', 'deadline', 'budget', 'success', 'outOfScope'),
  },
  change: {
    id: 'change',
    name: 'Change request or bug report',
    fields: pick('problem', 'current', 'pages', 'audience', 'deadline', 'success'),
  },
};

export function getTemplate(id) {
  const t = TEMPLATES[id];
  if (!t) throw new Error(`Unknown template ${id}`);
  return t;
}
