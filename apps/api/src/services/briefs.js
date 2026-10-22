import crypto from 'node:crypto';
import { config } from '../config.js';
import { Project } from '../models/index.js';
import { badRequest, conflict } from '../utils/errors.js';
import { claudeEngine } from './engine-claude.js';
import { offlineEngine } from './engine-offline.js';
import { getTemplate } from './templates.js';
import { wireframeOutline } from './wireframe.js';

export function pickEngine() {
  const mode = config.ai.engine;
  if (mode === 'offline') return offlineEngine;
  if (mode === 'claude' || (mode === 'auto' && config.ai.apiKey)) return claudeEngine;
  return offlineEngine;
}

/** Run an engine step; if Claude fails, fall back to the offline engine so the client is never stuck. */
async function run(method, args) {
  const engine = pickEngine();
  try {
    return { result: await engine[method](args), engine: engine.name };
  } catch (err) {
    if (engine === offlineEngine) throw err;
    console.error(`[ai] Claude ${method} failed, using offline engine:`, err.message);
    return { result: await offlineEngine[method](args), engine: 'offline' };
  }
}

export const newToken = () => crypto.randomBytes(18).toString('base64url');

function plainBrief(project) {
  const b = project.brief?.toObject ? project.brief.toObject() : project.brief || {};
  return { ...b, fields: Object.fromEntries(project.brief?.fields || []) };
}

function context(project, developerName) {
  return {
    template: getTemplate(project.template),
    clientName: project.clientName,
    developerName,
    initialRequest: project.initialRequest,
    messages: project.messages.map((m) => (m.toObject ? m.toObject() : m)),
    fields: Object.fromEntries(project.brief?.fields || []),
    brief: plainBrief(project),
    pending: project.pending || {},
  };
}

function completeness(template, fields) {
  const filled = template.fields.filter((f) => (fields[f.key] || '').trim()).length;
  return Math.round((filled / template.fields.length) * 100);
}

function applyResult(project, result, template) {
  const fields = { ...Object.fromEntries(project.brief.fields || []) };
  for (const [k, v] of Object.entries(result.fields || {})) if (v && v.trim()) fields[k] = v.trim();
  project.brief.fields = fields;
  if (result.vague) project.brief.vague = result.vague;
  if (result.contradictions) project.brief.contradictions = result.contradictions;
  if (result.assumptions) project.brief.assumptions = result.assumptions;
  if (result.openQuestions) project.brief.openQuestions = result.openQuestions;
  project.pending = result.pending || {};
  project.markModified('pending');
  project.completeness = result.done ? 100 : Math.min(99, completeness(template, fields));
  project.messages.push({ role: 'assistant', text: result.reply, question: result.question || undefined });
}

export async function startConversation(project, developerName) {
  if (project.messages.length) return project;
  const ctx = context(project, developerName);
  const { result, engine } = await run('start', ctx);
  project.engine = engine;
  applyResult(project, result, ctx.template);
  await project.save();
  return project;
}

export async function clientAnswer(project, answer, developerName) {
  if (project.status !== 'gathering') throw conflict('This brief is no longer collecting answers');
  const text = [...(answer.selected || []), answer.other].filter(Boolean).join(' ').trim();
  if (!text) throw badRequest('Please choose an option or type an answer');
  // Answer to a question the developer typed in: keep it as a note, then let the engine carry on
  if (project.pending?.kind === 'developer') {
    const q = [...project.messages].reverse().find((m) => m.role === 'developer');
    project.brief.notes = [...(project.brief.notes || []), `Q: ${q?.text} | A: ${text}`];
  }
  project.messages.push({ role: 'client', answer });
  const ctx = context(project, developerName);
  const { result, engine } = await run('turn', { ...ctx, answer });
  project.engine = engine;
  applyResult(project, result, ctx.template);
  if (result.done) {
    const fin = await run('finalize', context(project, developerName));
    project.brief.summary = fin.result.summary;
    project.brief.stories = fin.result.stories;
    project.brief.risks = fin.result.risks;
    project.brief.wireframe = (await run('wireframe', context(project, developerName))).result;
    project.status = 'review';
    pushSketch(
      project,
      "Here's a rough sketch of how the pages could be laid out, based on your answers. It's not the final design, just the layout.\n\nDoes it look like what you had in mind? Tap 👍 Looks right, or just tell me what to change, for example “add a Compare button next to Add to cart” or “I don't need the account page”.",
    );
  }
  await project.save();
  return project;
}

/** Developer asks the client an extra question; reopens the conversation. */
export async function developerQuestion(project, text, options = []) {
  project.messages.push({ role: 'developer', text, question: { text, options, multi: false } });
  project.pending = { kind: 'developer', field: null, queue: [] };
  project.markModified('pending');
  if (project.status !== 'gathering') project.status = 'gathering';
  await project.save();
  return project;
}

export async function regenerateStories(project, developerName) {
  const fin = await run('finalize', context(project, developerName));
  project.brief.summary = fin.result.summary;
  project.brief.stories = fin.result.stories;
  project.brief.risks = fin.result.risks;
  await project.save();
  return project;
}

const copy = (x) => JSON.parse(JSON.stringify(x));

/** Post the current wireframe into the chat as its own message, so every version stays in the conversation. */
function pushSketch(project, text) {
  project.messages.push({ role: 'assistant', kind: 'sketch', text, wireframe: copy(project.brief.wireframe) });
}

const hasSketch = (project) => project.brief?.wireframe?.screens?.length > 0;

/** Apply one change request to the current wireframe. Returns { applied, reply }. */
async function revise(project, developerName, request) {
  const ctx = context(project, developerName);
  const { result } = await run('reviseWireframe', { ...ctx, request });
  if (result.applied) {
    project.brief.wireframe = result.wireframe;
    project.markModified('brief.wireframe');
    project.brief.wireframeOk = null;
  }
  return result;
}

/** The layout changed: a signed brief becomes "changed"; one awaiting approval goes back to the developer. */
function reopen(project) {
  if (project.status === 'signed') project.status = 'changed';
  else if (project.status === 'awaiting_signoff') project.status = 'review';
}

/**
 * Developer updates the sketch. With `request`, applies that instruction. Otherwise applies any
 * client change requests that haven't been applied yet, or redraws from the brief if there are none.
 * Returns { project, notice } so the UI can say what happened.
 */
export async function regenerateWireframe(project, developerName, request) {
  let notice;
  if (request) {
    if (!hasSketch(project)) throw conflict('There is no sketch yet. Generate one first.');
    const r = await revise(project, developerName, request);
    if (!r.applied) return { project, notice: `Couldn't work out how to apply “${request}” to the layout. Try wording it like “add a Compare button next to Add to cart”, “remove the reviews section” or “move the photos above the price”.` };
    pushSketch(project, `${developerName} updated the sketch: ${r.reply.replace(/^Done, I've updated the sketch: /, '')}`);
    notice = r.reply;
  } else {
    const pending = (project.brief.feedback || []).filter((f) => !f.applied);
    if (pending.length && hasSketch(project)) {
      const done = [];
      const skipped = [];
      for (const f of pending) {
        const r = await revise(project, developerName, f.text);
        if (r.applied) {
          f.applied = new Date();
          done.push(r.reply);
        } else skipped.push(f.text);
      }
      project.markModified('brief.feedback');
      if (done.length) pushSketch(project, `${developerName} updated the sketch with your changes. ${done.join(' ')}`);
      notice = [
        done.length ? `Applied ${done.length} change request(s).` : '',
        skipped.length ? `Couldn't apply automatically: ${skipped.map((x) => `“${x}”`).join(', ')}. Edit the brief or type an instruction under the sketch.` : '',
      ].filter(Boolean).join(' ');
    } else {
      project.brief.wireframe = (await run('wireframe', context(project, developerName))).result;
      project.markModified('brief.wireframe');
      project.brief.wireframeOk = null;
      pushSketch(project, `${developerName} redrew the sketch from the brief. Does this look right?`);
      notice = 'Redrew the sketch from the brief.';
    }
  }
  reopen(project);
  await project.save();
  return { project, notice };
}

/**
 * The client keeps chatting after the interview. Layout requests update the sketch straight away
 * (new sketch posted in the chat); anything else is passed on to the developer.
 */
export async function clientMessage(project, text, developerName) {
  if (project.status === 'gathering') throw conflict('Please answer the question above first');
  project.messages.push({ role: 'client', kind: 'chat', answer: { selected: [], other: text } });
  const entry = { text, at: new Date() };
  let r = { applied: false };
  if (hasSketch(project)) r = await revise(project, developerName, text);
  if (r.applied) {
    entry.applied = new Date();
    pushSketch(project, `${r.reply}\n\nAnything else? If it looks right now, tap 👍 Looks right.`);
    reopen(project);
  } else {
    project.messages.push({
      role: 'assistant',
      kind: 'chat',
      text: `Thanks, I've passed that on to ${developerName || 'the developer'}, who will update the brief${hasSketch(project) ? ' and sketch' : ''} and get back to you here.`,
    });
    if (project.status === 'awaiting_signoff') project.status = 'review';
  }
  project.brief.feedback = [...(project.brief.feedback || []), entry];
  await project.save();
  return project;
}

/** Kept for the "Request changes" box on the approval page. */
export const clientFeedback = (project, text, developerName) => clientMessage(project, text, developerName);

/** Client confirms the rough wireframe matches what they meant. */
export async function wireframeLooksRight(project, developerName) {
  if (!hasSketch(project)) throw conflict('There is no sketch to confirm yet');
  if (project.status === 'gathering') throw conflict('Please finish the questions first');
  project.brief.wireframeOk = new Date();
  project.messages.push({ role: 'client', kind: 'chat', answer: { selected: ['👍 Looks right'], other: '' } });
  project.messages.push({
    role: 'assistant',
    kind: 'chat',
    text: `Great, I've let ${developerName || 'the developer'} know the layout is right. You'll get the full brief to approve here. You can still message me if anything else comes to mind.`,
  });
  await project.save();
  return project;
}

const snapshot = (project) => JSON.parse(JSON.stringify(plainBrief(project)));

/** Freeze the current brief as a new version and send it to the client to approve. */
export async function sendForSignoff(project, note) {
  if (!Object.keys(Object.fromEntries(project.brief.fields || [])).length) throw badRequest('The brief is empty');
  const n = (project.versions.at(-1)?.n || 0) + 1;
  project.versions.push({ n, brief: snapshot(project), note });
  project.status = 'awaiting_signoff';
  await project.save();
  return project;
}

export async function signOff(project, { name }) {
  if (project.status !== 'awaiting_signoff') throw conflict('There is nothing waiting for approval');
  const v = project.versions.at(-1);
  v.signedBy = name;
  v.signedAt = new Date();
  project.signedVersion = v.n;
  project.status = 'signed';
  await project.save();
  return project;
}

/** Developer edits to the brief. After sign-off, edits mark the project as changed. */
export async function editBrief(project, patch) {
  for (const [k, v] of Object.entries(patch.fields || {})) project.brief.fields.set(k, v);
  for (const k of ['summary', 'stories', 'risks', 'assumptions', 'openQuestions', 'contradictions']) {
    if (patch[k] !== undefined) project.brief[k] = patch[k];
  }
  if (project.status === 'signed') project.status = 'changed';
  await project.save();
  return project;
}

/** Field-by-field differences between the signed version and the current brief. */
export function diffAgainstSigned(project) {
  const signed = project.versions.find((v) => v.n === project.signedVersion);
  if (!signed) return [];
  const template = getTemplate(project.template);
  const before = Object.fromEntries(signed.brief.fields || []);
  const after = Object.fromEntries(project.brief.fields || []);
  const changes = [];
  for (const f of template.fields) {
    if ((before[f.key] || '') !== (after[f.key] || '')) changes.push({ key: f.key, label: f.label, before: before[f.key] || '', after: after[f.key] || '' });
  }
  const storyText = (b) => (b.stories || []).map((s) => `${s.iWant} [${(s.acceptance || []).join(' | ')}]`).join('\n');
  if (storyText(signed.brief) !== storyText(project.brief)) {
    changes.push({ key: 'stories', label: 'User stories', before: storyText(signed.brief), after: storyText(project.brief) });
  }
  if (JSON.stringify(signed.brief.wireframe || null) !== JSON.stringify(project.brief.wireframe || null)) {
    changes.push({ key: 'wireframe', label: 'Wireframe', before: `${signed.brief.wireframe?.screens?.length || 0} screen(s)`, after: 'Layout updated' });
  }
  if ((signed.brief.summary || '') !== (project.brief.summary || '')) {
    changes.push({ key: 'summary', label: 'Summary', before: signed.brief.summary || '', after: project.brief.summary || '' });
  }
  return changes;
}

export function briefMarkdown(project) {
  const t = getTemplate(project.template);
  const b = project.brief;
  const f = Object.fromEntries(b.fields || []);
  const lines = [`# ${project.name}`, '', `**Client:** ${project.clientName}  `, `**Type:** ${t.name}  `, `**Status:** ${project.status}${project.signedVersion ? ` (v${project.signedVersion} signed)` : ''}`, ''];
  if (b.summary) lines.push('## Summary', '', b.summary, '');
  lines.push('## Requirements', '');
  for (const fd of t.fields) lines.push(`- **${fd.label}:** ${f[fd.key] || '_not answered_'}`);
  if (b.stories?.length) {
    lines.push('', '## User stories', '');
    b.stories.forEach((s, i) => {
      lines.push(`${i + 1}. As a ${s.asA}, I want ${s.iWant}, so that ${s.soThat}.`);
      for (const a of s.acceptance || []) lines.push(`   - [ ] ${a}`);
    });
  }
  const list = (title, arr) => arr?.length && lines.push('', `## ${title}`, '', ...arr.map((x) => `- ${x}`));
  list('Clarified terms', (b.vague || []).map((v) => `"${v.quote}" → ${v.resolved ? v.answer : '_not clarified_'}`));
  const wf = wireframeOutline(b.wireframe);
  if (wf.length) lines.push('', '## Wireframe (rough layout)', '', ...wf);
  list('Client feedback', (b.feedback || []).map((f) => f.text));
  list('Answers to developer questions', b.notes);
  list('Contradictions to resolve', b.contradictions);
  list('Assumptions', b.assumptions);
  list('Open questions', b.openQuestions);
  list('Risks', b.risks);
  const signed = project.versions.find((v) => v.n === project.signedVersion);
  if (signed) lines.push('', '---', `Signed off by ${signed.signedBy} on ${signed.signedAt.toISOString().slice(0, 10)} (version ${signed.n}).`);
  return lines.join('\n') + '\n';
}
