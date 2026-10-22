/**
 * Claude-powered brief engine. Each turn sends the checklist, the conversation
 * so far and the current brief, and gets back JSON that is guaranteed to match
 * a schema (Structured Outputs via `output_config.format`).
 *
 * Docs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { answerText } from './engine-offline.js';
import { cleanWireframe, REVISION_SCHEMA, WIREFRAME_SCHEMA } from './wireframe.js';

let client;
let clientKey;
function anthropic() {
  const baseURL = process.env.ANTHROPIC_BASE_URL || undefined;
  const key = `${config.ai.apiKey}|${baseURL}`;
  if (!client || clientKey !== key) {
    client = new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL,
      maxRetries: 2,
      timeout: 60_000, // keep the client chat responsive; we fall back to the offline engine on failure
    });
    clientKey = key;
  }
  return client;
}

const str = { type: 'string' };
const strArr = { type: 'array', items: str };

function turnSchema(template) {
  const fieldProps = Object.fromEntries(template.fields.map((f) => [f.key, str]));
  return {
    type: 'object',
    properties: {
      reply: { type: 'string', description: 'Short, friendly message to the client: acknowledge/restate their answer in one sentence.' },
      question: {
        type: 'object',
        properties: {
          text: str,
          options: { type: 'array', items: str, description: '2-6 concrete choices, or empty for a free-text question' },
          multi: { type: 'boolean' },
        },
        required: ['text', 'options', 'multi'],
        additionalProperties: false,
      },
      fields: {
        type: 'object',
        description: 'Current best understanding of every checklist field. Empty string if still unknown.',
        properties: fieldProps,
        required: template.fields.map((f) => f.key),
        additionalProperties: false,
      },
      vague: {
        type: 'array',
        items: {
          type: 'object',
          properties: { term: str, quote: str, field: str, answer: str, resolved: { type: 'boolean' } },
          required: ['term', 'quote', 'field', 'answer', 'resolved'],
          additionalProperties: false,
        },
      },
      contradictions: strArr,
      assumptions: strArr,
      openQuestions: strArr,
      done: { type: 'boolean', description: 'True only when every field is answered specifically enough to build and test.' },
    },
    required: ['reply', 'question', 'fields', 'vague', 'contradictions', 'assumptions', 'openQuestions', 'done'],
    additionalProperties: false,
  };
}

const FINAL_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '3-5 sentence plain-English summary of what will be built and why.' },
    stories: {
      type: 'array',
      items: {
        type: 'object',
        properties: { asA: str, iWant: str, soThat: str, acceptance: strArr },
        required: ['asA', 'iWant', 'soThat', 'acceptance'],
        additionalProperties: false,
      },
    },
    risks: strArr,
  },
  required: ['summary', 'stories', 'risks'],
  additionalProperties: false,
};

function systemPrompt(template, developerName) {
  const checklist = template.fields.map((f) => `- ${f.key} (${f.label}): ${f.hint}`).join('\n');
  return `You are a requirements assistant interviewing a non-technical client on behalf of a web developer (${developerName || 'the developer'}).
Project type: ${template.name}.

Your job: turn a vague request into a brief clear enough to build and test. A complete brief covers:
${checklist}

Rules:
- Ask exactly ONE question per turn. Prefer 2-6 concrete options the client can tap; the client can always type their own answer.
- Start the reply by briefly restating what you understood from their last answer, so they can correct you.
- When the client uses vague words ("modern", "simple", "user-friendly", "fast", "like <site>", "ASAP", "etc."), ask what they mean with concrete options before moving on. Record each in "vague" with the client's exact words; set resolved=true once clarified.
- If an answer is thin, ask for a real example (which page, what happened, how often).
- Record contradictions between answers, assumptions you are making, and anything the client is unsure about (openQuestions). Don't push a client who is unsure; note it and move on.
- Never promise prices, timelines or technical solutions. Never invent facts about the client's business.
- Plain language, no jargon. Reply in the client's language (English or Bahasa Malaysia).
- Keep "fields" as your full, current understanding of every checklist item (concise, specific). Use "" if unknown.
- Set done=true only when every field is specific enough to build and test, or the client has said they are unsure.`;
}

function transcript(messages) {
  return messages
    .map((m) => {
      if (m.role === 'client') return `CLIENT: ${answerText(m.answer || {}) || m.text}`;
      const q = m.question ? `\n  [question: ${m.question.text}${m.question.options?.length ? ` | options: ${m.question.options.join(' / ')}` : ''}]` : '';
      return `${m.role === 'developer' ? 'DEVELOPER' : 'ASSISTANT'}: ${m.text || ''}${q}`;
    })
    .join('\n');
}

async function claudeCallJson({ system, user, schema, maxTokens = 2000 }) {
  const res = await anthropic().messages.create({
    model: config.ai.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  if (res.stop_reason !== 'end_turn') throw new Error(`Claude stopped with ${res.stop_reason}`);
  const block = res.content.find((b) => b.type === 'text');
  if (!block) throw new Error('No text block in Claude response');
  return JSON.parse(block.text);
}

/**
 * The interview logic is the same for every AI provider; only `callJson` differs
 * (Claude here, OpenAI-compatible providers such as Ollama/Groq in engine-openai.js).
 * callJson({ system, user, schema, maxTokens }) must resolve to an object matching `schema`.
 */
export function makeEngine(name, callJson) {
  return {
  name,

  async start({ template, clientName, developerName, initialRequest, messages = [] }) {
    const out = await callJson({
      system: systemPrompt(template, developerName),
      schema: turnSchema(template),
      user: `The client is ${clientName}. Their original request (may be vague): """${initialRequest || '(none given)'}"""
Greet them briefly, explain you'll ask a few quick questions (about 5 minutes), then ask the first question.
Conversation so far:\n${transcript(messages) || '(none)'}`,
    });
    return { ...out, pending: { kind: 'ai' } };
  },

  async turn({ template, developerName, clientName, initialRequest, messages, fields, brief, answer }) {
    const out = await callJson({
      system: systemPrompt(template, developerName),
      schema: turnSchema(template),
      user: `Client: ${clientName}. Original request: """${initialRequest || '(none)'}"""
Current brief (JSON): ${JSON.stringify({ fields, vague: brief.vague, contradictions: brief.contradictions, assumptions: brief.assumptions, openQuestions: brief.openQuestions })}
Conversation so far:\n${transcript(messages)}
The client just answered: """${answerText(answer)}"""
Update the brief and either ask the next question or set done=true with a closing message.`,
    });
    if (out.done) out.question = null;
    return { ...out, pending: { kind: out.done ? 'done' : 'ai' } };
  },

  async finalize({ template, developerName, fields, brief, messages }) {
    return callJson({
      system: `You write concise, testable project briefs for ${developerName || 'a web developer'}. Use only facts from the input; mark anything uncertain as a risk.`,
      schema: FINAL_SCHEMA,
      maxTokens: 3000,
      user: `Project type: ${template.name}
Brief fields: ${JSON.stringify(fields)}
Clarified terms: ${JSON.stringify(brief.vague)}
Contradictions: ${JSON.stringify(brief.contradictions)}
Assumptions: ${JSON.stringify(brief.assumptions)}
Open questions: ${JSON.stringify(brief.openQuestions)}
Transcript:\n${transcript(messages)}

Write: a short summary; user stories (As a / I want / So that) each with 2-4 testable acceptance criteria; risks (contradictions, open questions, unrealistic expectations).`,
    });
  },

  async wireframe({ template, developerName, fields, brief }) {
    const wf = await callJson({
      system: `You sketch LOW-FIDELITY wireframes for ${developerName || 'a web developer'} to show a non-technical client before they approve a brief.
Rules:
- One screen per page/screen the brief affects (max 5). Use only the allowed block types.
- Each block: short title, items as labels (e.g. form fields, table columns, button labels), no real copy, no colours.
- Use "note" to explain WHY a block exists, quoting what the client said (e.g. 'You said "modern" -> big, bold photos'). Leave note empty when obvious.
- Include a nav at the top and footer at the bottom of each screen. Use "floating" for floating buttons (e.g. WhatsApp).
- device = "mobile" if most users are on phones, else "desktop".
- Do not invent features the client did not ask for.`,
      schema: WIREFRAME_SCHEMA,
      maxTokens: 4000,
      user: `Project type: ${template.name}
Brief: ${JSON.stringify(fields)}
Clarified terms: ${JSON.stringify(brief.vague)}
User stories: ${JSON.stringify(brief.stories || [])}`,
    });
    return cleanWireframe(wf);
  },

  async reviseWireframe({ developerName, clientName, fields, brief, request }) {
    const out = await callJson({
      system: `You update a LOW-FIDELITY wireframe (JSON) after the client asks for a change. ${developerName || 'The developer'} will review it later.
Rules:
- Apply exactly what ${clientName || 'the client'} asked: add, remove, move or rename blocks/items/screens. Keep everything else identical, in the same order.
- Mark every block you add or change with note = 'You asked: "<short quote of the request>"'.
- Use only the allowed block types. "Next to" a button means adding an item to that same buttons block, right after it.
- If the request is about colours, fonts, wording, prices or anything that is not layout, or is too unclear to apply, set applied=false and return the wireframe unchanged.
- reply: one or two plain sentences to the client describing what changed. No jargon.`,
      schema: REVISION_SCHEMA,
      maxTokens: 6000,
      user: `Brief: ${JSON.stringify(fields)}
Current wireframe: ${JSON.stringify(brief.wireframe)}
Client's change request: """${request}"""`,
    });
    return { applied: !!out.applied, reply: out.reply || '', wireframe: out.applied ? cleanWireframe(out.wireframe) : brief.wireframe };
  },
};
}

export const claudeEngine = makeEngine('claude', claudeCallJson);
