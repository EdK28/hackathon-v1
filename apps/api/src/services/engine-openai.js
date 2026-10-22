/**
 * Engine for any OpenAI-compatible chat API, so you can demo Clarify with free models:
 *   - Ollama (runs on your own computer, free, no key):  LLM_BASE_URL=http://localhost:11434/v1
 *   - Groq (free tier, needs a free key):                  LLM_BASE_URL=https://api.groq.com/openai/v1
 *   - OpenRouter (":free" models, needs a free key):       LLM_BASE_URL=https://openrouter.ai/api/v1
 *
 * Uses the same prompts as the Claude engine (makeEngine). It asks for strict JSON-schema output;
 * if a provider/model doesn't support that, it falls back to plain JSON mode with the schema in the
 * prompt, then repairs small gaps (missing fields) so the app doesn't break on smaller models.
 */
import { config } from '../config.js';
import { makeEngine } from './engine-claude.js';

const modeCache = new Map(); // baseUrl|model -> 'schema' | 'json'

/** Fill in fields a small model left out, using the schema's types. */
export function fillDefaults(schema, value) {
  if (!schema) return value;
  if (schema.type === 'object') {
    const obj = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
    for (const [k, sub] of Object.entries(schema.properties || {})) obj[k] = fillDefaults(sub, obj[k]);
    return obj;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return [];
    return value.map((v) => fillDefaults(schema.items, v));
  }
  if (schema.type === 'string') {
    if (typeof value === 'string') return schema.enum && !schema.enum.includes(value) ? schema.enum[0] : value;
    return value == null ? (schema.enum ? schema.enum[0] : '') : String(value);
  }
  if (schema.type === 'boolean') return value === true || value === 'true';
  return value;
}

/** Pull the JSON object out of a reply that may include <think> blocks or ``` fences. */
export function extractJson(text) {
  const cleaned = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The model did not return JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function post(body) {
  const { baseUrl, apiKey, timeoutMs } = config.ai.llm;
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`LLM API ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return JSON.parse(text);
}

async function openaiCallJson({ system: baseSystem, user, schema, maxTokens = 2000 }) {
  let system = baseSystem;
  const { baseUrl, model } = config.ai.llm;
  if (!baseUrl || !model) throw new Error('Set LLM_BASE_URL and LLM_MODEL to use a free/open model');
  const key = `${baseUrl}|${model}`;
  // Qwen3 "thinks" before answering by default, which is slow on a laptop and not needed here
  if (/qwen3/i.test(model)) system = `${system}\n\n/no_think`;
  const base = { model, temperature: 0.2, max_tokens: maxTokens };

  let mode = modeCache.get(key) || 'schema';
  let data;
  if (mode === 'schema') {
    try {
      data = await post({
        ...base,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        response_format: { type: 'json_schema', json_schema: { name: 'output', strict: true, schema } },
      });
    } catch (err) {
      // Provider/model doesn't do JSON schemas: switch to plain JSON mode for this model
      if (err.status && err.status >= 400 && err.status < 500 && /response_format|json_schema|schema|not supported|unsupported/i.test(err.body || '')) {
        mode = 'json';
        modeCache.set(key, 'json');
      } else throw err;
    }
  }
  if (mode === 'json') {
    data = await post({
      ...base,
      messages: [
        { role: 'system', content: `${system}\n\nReply with ONLY a JSON object (no other text) that matches this JSON schema exactly:\n${JSON.stringify(schema)}` },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    });
  }
  const choice = data.choices?.[0];
  if (!choice) throw new Error('LLM API returned no choices');
  if (choice.finish_reason === 'length') throw new Error('The model ran out of tokens; try a larger context or model');
  return fillDefaults(schema, extractJson(choice.message?.content));
}

export const openaiEngine = makeEngine('llm', openaiCallJson);
// Show which model answered (e.g. "llm: qwen2.5:7b") on the project page
Object.defineProperty(openaiEngine, 'name', { get: () => `llm: ${config.ai.llm.model || 'not set'}`, enumerable: true });
