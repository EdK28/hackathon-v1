import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { config } from '../src/config.js';
import { Project } from '../src/models/index.js';
import { answerAll, app, devAgent, setup } from './helpers.js';

config.ai.engine = 'offline';
beforeEach(setup);
after(() => mongoose.disconnect());

const NEW = {
  name: 'Zontes shop homepage',
  clientName: 'Mr Tan',
  template: 'feature',
  initialRequest: 'Can you make the homepage more modern and user friendly? Need it ASAP.',
};

async function create(agent, body = NEW) {
  const r = await agent.post('/api/projects').send(body);
  assert.equal(r.status, 201, r.text);
  return r.body.project;
}
const tokenOf = (p) => p.clientLink.split('/b/')[1];

describe('conversation', () => {
  test('opens with a greeting, quotes the vague request and asks the first question with options', async () => {
    const dev = await devAgent();
    const p = await create(dev);
    assert.equal(p.status, 'gathering');
    const first = p.messages[0];
    assert.match(first.text, /Mr Tan/);
    assert.match(first.text, /more modern and user friendly/);
    assert.ok(first.question.options.length >= 2);
    // vague words in the original request are flagged straight away
    const terms = p.brief.vague.map((v) => v.term);
    assert.deepEqual(terms, ['modern', 'user-friendly', 'ASAP']);
  });

  test('a vague client ends with a complete, specific brief', async () => {
    const dev = await devAgent();
    const p = await create(dev);
    const { asked, project } = await answerAll(tokenOf(p));

    // it chased every vague word from the first message...
    for (const t of ['modern', 'user-friendly', 'ASAP']) assert.ok(asked.includes(`followup:${t}`), `missing follow-up for ${t}: ${asked}`);
    // ...asked for a real example when the answer was thin ("website not nice")...
    assert.ok(asked.includes('detail'));
    // ...and followed up "like NVIDIA" in the references answer
    assert.ok(asked.some((a) => a.startsWith('followup:') && ['like another site', 'modern'].includes(a.split(':')[1])));

    assert.equal(project.status, 'review');
    assert.equal(project.completeness, 100);
    const b = project.brief;
    assert.ok(b.vague.every((v) => v.resolved), JSON.stringify(b.vague));
    assert.match(b.fields.get('problem'), /WhatsApp us to ask if parts fit/);
    assert.ok(b.contradictions.some((c) => /2 weeks/.test(c)), 'should flag 5 must-haves in 2 weeks');
    assert.ok(b.stories.length >= 5);
    assert.ok(b.stories.find((s) => s.iWant === 'to pay online at checkout').acceptance.length >= 2);
    // the client's real problem becomes the first story, in readable English
    assert.match(b.stories[0].iWant, /parts fit/);
    assert.equal(b.stories[0].asA, 'retail customer');
    assert.equal(b.stories[0].soThat, 'more customers complete their order online');
    assert.doesNotMatch(b.summary, /\.\./);
    assert.ok(b.summary.length > 20);
  });

  test('"not sure" answers become open questions instead of blocking the client', async () => {
    const dev = await devAgent();
    const p = await create(dev, { ...NEW, initialRequest: '' });
    await answerAll(tokenOf(p), { goal: { selected: ['Not sure yet'] } });
    const project = await Project.findById(p.id);
    assert.equal(project.status, 'review');
    assert.ok(project.brief.openQuestions.some((q) => q.startsWith('Goal')));
  });

  test('a developer question reopens the chat and the answer is recorded', async () => {
    const dev = await devAgent();
    const p = await create(dev);
    await answerAll(tokenOf(p));
    const r = await dev.post(`/api/projects/${p.id}/ask`).send({ text: 'Should prices show with or without SST?', options: ['With SST', 'Without SST'] });
    assert.equal(r.body.project.status, 'gathering');
    await request(app).post(`/api/c/${tokenOf(p)}/answer`).send({ selected: ['With SST'] }).expect(200);
    const project = await Project.findById(p.id);
    assert.equal(project.status, 'review');
    assert.ok(project.brief.notes.some((n) => n.includes('SST') && n.includes('With SST')));
  });
});

describe('sign-off and change control', () => {
  test('client signs a frozen version; later edits are shown as changes', async () => {
    const dev = await devAgent();
    const p = await create(dev);
    const token = tokenOf(p);
    await answerAll(token);

    // can't sign before it's sent
    assert.equal((await request(app).post(`/api/c/${token}/signoff`).send({ name: 'Mr Tan', agree: true })).status, 409);

    await dev.post(`/api/projects/${p.id}/send`).send({ note: 'First draft' }).expect(200);
    const signed = await request(app).post(`/api/c/${token}/signoff`).send({ name: 'Mr Tan', agree: true });
    assert.equal(signed.body.project.status, 'signed');
    assert.equal(signed.body.project.signedVersion, 1);

    const edit = await dev.patch(`/api/projects/${p.id}/brief`).send({ fields: { deadline: 'Within a month' } });
    assert.equal(edit.body.project.status, 'changed');
    const change = edit.body.project.changes.find((c) => c.key === 'deadline');
    assert.equal(change.before, 'Within 2 weeks');
    assert.equal(change.after, 'Within a month');

    // re-send creates version 2 for the client to approve
    const v2 = await dev.post(`/api/projects/${p.id}/send`).send({ note: 'Deadline moved' });
    assert.equal(v2.body.project.versions.length, 2);
    assert.equal(v2.body.project.status, 'awaiting_signoff');
  });

  test('markdown export contains requirements, stories and sign-off', async () => {
    const dev = await devAgent();
    const p = await create(dev);
    await answerAll(tokenOf(p));
    await dev.post(`/api/projects/${p.id}/send`).send({});
    await request(app).post(`/api/c/${tokenOf(p)}/signoff`).send({ name: 'Mr Tan', agree: true });
    const md = await dev.get(`/api/projects/${p.id}/brief.md`);
    assert.equal(md.status, 200);
    assert.match(md.text, /## User stories/);
    assert.match(md.text, /- \[ \] /);
    assert.match(md.text, /Signed off by Mr Tan/);
    assert.match(md.text, /"modern" → /);
  });
});

describe('access control', () => {
  test('developers only see their own projects; bad client links are rejected', async () => {
    const a = await devAgent('a@t.local');
    const b = await devAgent('b@t.local');
    const p = await create(a);
    assert.equal((await b.get(`/api/projects/${p.id}`)).status, 404);
    assert.equal((await b.get('/api/projects')).body.projects.length, 0);
    assert.equal((await request(app).get('/api/projects')).status, 401);
    assert.equal((await request(app).get('/api/c/not-a-real-token')).status, 404);
    // the client view never exposes the developer-only fields
    const c = await request(app).get(`/api/c/${tokenOf(p)}`);
    assert.equal(c.status, 200);
    assert.equal(c.body.project.clientLink, undefined);
    assert.equal(c.body.project.initialRequest, undefined);
  });
});

describe('Claude engine fallback', () => {
  test('if the Claude API fails, the conversation continues with the offline engine', async () => {
    const saved = { ...config.ai };
    config.ai.engine = 'claude';
    config.ai.apiKey = 'sk-test-invalid';
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9'; // nothing listens here: fails fast
    try {
      const dev = await devAgent();
      const p = await create(dev);
      assert.equal(p.engine, 'offline');
      assert.ok(p.messages[0].question);
    } finally {
      Object.assign(config.ai, saved);
    }
  });
});

describe('Claude engine request/response (against a fake API server)', () => {
  test('sends the checklist schema via output_config and applies the JSON it gets back', async () => {
    const http = await import('node:http');
    const seen = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const json = JSON.parse(body);
        seen.push({ path: req.url, json });
        const fields = Object.fromEntries(Object.keys(json.output_config.format.schema.properties.fields?.properties || {}).map((k) => [k, '']));
        fields.goal = 'More online orders from mobile users';
        const payload = {
          reply: 'Hi Mr Tan! A few quick questions.',
          question: { text: 'Who mainly uses the site?', options: ['Retail customers', 'Dealers'], multi: true },
          fields,
          vague: [{ term: 'modern', quote: 'more modern', field: 'initialRequest', answer: '', resolved: false }],
          contradictions: [],
          assumptions: [],
          openQuestions: [],
          done: false,
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          id: 'msg_test', type: 'message', role: 'assistant', model: json.model,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
          stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 },
        }));
      });
    });
    await new Promise((r) => server.listen(0, r));
    const saved = { ...config.ai };
    config.ai.engine = 'claude';
    config.ai.apiKey = 'sk-test';
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
    try {
      const { claudeEngine } = await import('../src/services/engine-claude.js');
      // reset the cached SDK client so it picks up the fake base URL
      const dev = await devAgent();
      const p = await create(dev);
      assert.equal(p.engine, 'claude', 'should not have fallen back');
      assert.equal(p.messages[0].question.text, 'Who mainly uses the site?');
      assert.equal(p.brief.fields.goal, 'More online orders from mobile users');
      const req = seen[0];
      assert.equal(req.path, '/v1/messages');
      assert.equal(req.json.model, config.ai.model);
      assert.equal(req.json.output_config.format.type, 'json_schema');
      assert.deepEqual(req.json.output_config.format.schema.properties.fields.required, ['goal', 'audience', 'problem', 'pages', 'mustHaves', 'references', 'content', 'integrations', 'deadline', 'success', 'outOfScope']);
      assert.match(req.json.system, /Ask exactly ONE question/);
      void claudeEngine;
    } finally {
      Object.assign(config.ai, saved);
      delete process.env.ANTHROPIC_BASE_URL;
      server.close();
    }
  });
});

describe('free/open model engine (OpenAI-compatible, e.g. Ollama or Groq)', () => {
  /** Fake OpenAI-compatible server. `schemaOk` = whether it accepts response_format json_schema. */
  async function fakeLlm({ schemaOk }) {
    const http = await import('node:http');
    const seen = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const json = JSON.parse(body);
        seen.push({ path: req.url, auth: req.headers.authorization, json });
        if (json.response_format?.type === 'json_schema' && !schemaOk) {
          res.writeHead(400, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ error: { message: "response_format 'json_schema' is not supported by this model" } }));
        }
        // A small model's typical reply: thinking, a code fence, and some fields left out
        const payload = {
          reply: 'Hi Mr Tan!',
          question: { text: 'Who mainly uses the site?', options: ['Retail customers', 'Dealers'], multi: true },
          fields: { goal: 'More online orders' },
          done: false,
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          id: 'c1', object: 'chat.completion', model: json.model,
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: `<think>plan the question</think>\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\`` } }],
        }));
      });
    });
    await new Promise((r) => server.listen(0, r));
    return { server, seen, url: `http://127.0.0.1:${server.address().port}/v1` };
  }

  async function withLlm(opts, fn) {
    const fake = await fakeLlm(opts);
    const saved = { ...config.ai, llm: { ...config.ai.llm } };
    config.ai.engine = 'auto';
    config.ai.apiKey = ''; // no Claude key: auto should pick the free model
    config.ai.llm = { baseUrl: fake.url, apiKey: 'free-key', model: `test-model-${opts.schemaOk ? 'a' : 'b'}`, timeoutMs: 5000 };
    try {
      await fn(fake);
    } finally {
      Object.assign(config.ai, saved);
      fake.server.close();
    }
  }

  test('auto mode uses it when LLM_BASE_URL is set, with strict JSON schema output', async () => {
    await withLlm({ schemaOk: true }, async ({ seen }) => {
      const p = await create(await devAgent());
      assert.equal(p.engine, 'llm: test-model-a');
      assert.equal(p.messages[0].question.text, 'Who mainly uses the site?');
      assert.equal(p.brief.fields.goal, 'More online orders');
      assert.equal(seen[0].path, '/v1/chat/completions');
      assert.equal(seen[0].auth, 'Bearer free-key');
      assert.equal(seen[0].json.response_format.type, 'json_schema');
    });
  });

  test('models without JSON-schema support fall back to JSON mode, and gaps are filled in', async () => {
    await withLlm({ schemaOk: false }, async ({ seen }) => {
      const p = await create(await devAgent());
      assert.equal(p.engine, 'llm: test-model-b', 'should not fall back to offline');
      assert.equal(p.messages[0].question.text, 'Who mainly uses the site?');
      assert.deepEqual(seen.map((s) => s.json.response_format.type), ['json_schema', 'json_object']);
      assert.match(seen[1].json.messages[0].content, /matches this JSON schema/);
    });
  });

  test('if the free model is unreachable, the client still gets a question (offline fallback)', async () => {
    const saved = { ...config.ai, llm: { ...config.ai.llm } };
    config.ai.engine = 'llm';
    config.ai.llm = { baseUrl: 'http://127.0.0.1:9/v1', apiKey: '', model: 'llama3.2', timeoutMs: 2000 };
    try {
      const p = await create(await devAgent());
      assert.equal(p.engine, 'offline');
      assert.ok(p.messages[0].question.text);
    } finally {
      Object.assign(config.ai, saved);
    }
  });
});

describe('wireframe', () => {
  test('a finished interview produces a wireframe tied to what the client said', async () => {
    const dev = await devAgent();
    const p = await create(dev);
    const { project } = await answerAll(tokenOf(p));
    const wf = project.brief.wireframe;
    assert.equal(wf.device, 'mobile'); // client said users are mostly on phones
    // the pages the client picked, plus an admin screen because "Admin dashboard / reports" is a must-have
    assert.deepEqual(wf.screens.map((s) => s.name), ['Home page', 'Product detail page', 'Admin pages']);
    assert.match(wf.screens[2].blocks.find((x) => x.type === 'chart').note, /admin dashboard/i);

    const home = wf.screens[0];
    const hero = home.blocks.find((x) => x.type === 'hero');
    assert.match(hero.note, /You said “modern/); // links the layout back to the clarified word
    assert.equal(home.blocks[0].type, 'nav');
    assert.ok(home.blocks[0].items.includes('Search'));

    const detail = wf.screens[1];
    const fits = detail.blocks.find((x) => x.title === 'Fits these models');
    assert.ok(fits, 'product page should show compatible models, because that was the client\'s problem');
    assert.match(fits.note, /parts fit/);
    assert.ok(detail.blocks.some((x) => x.type === 'floating' && /WhatsApp/.test(x.title)));
  });

  test('client confirms the sketch in the chat; a new sketch resets it', async () => {
    const dev = await devAgent();
    const p = await create(dev);
    const token = tokenOf(p);
    // not allowed mid-interview
    await request(app).post(`/api/c/${token}/wireframe-ok`).expect(409);
    await answerAll(token);
    const ok = await request(app).post(`/api/c/${token}/wireframe-ok`).expect(200);
    assert.ok(ok.body.project.brief.wireframeOk);
    assert.equal(ok.body.project.status, 'review');
    const regen = await dev.post(`/api/projects/${p.id}/wireframe`).expect(200);
    assert.equal(regen.body.project.brief.wireframeOk, null);
  });

  test('the chat continues after the interview: layout requests update the sketch in the chat', async () => {
    const dev = await devAgent();
    const p = await create(dev);
    const token = tokenOf(p);
    const { project } = await answerAll(token);
    // the first sketch is a chat message
    assert.equal(project.messages.filter((m) => m.kind === 'sketch').length, 1);

    const r = await request(app).post(`/api/c/${token}/message`).send({ text: 'Can you add a Compare button next to Add to cart?' }).expect(200);
    const msgs = r.body.project.messages;
    assert.equal(msgs.at(-2).role, 'client');
    const sketch = msgs.at(-1);
    assert.equal(sketch.kind, 'sketch');
    assert.match(sketch.text, /Compare/);
    const actions = sketch.wireframe.screens.flatMap((s) => s.blocks).find((x) => x.type === 'buttons' && x.items.includes('Add to cart'));
    assert.deepEqual(actions.items.slice(actions.items.indexOf('Add to cart'), actions.items.indexOf('Add to cart') + 2), ['Add to cart', 'Compare']);
    assert.ok(r.body.project.brief.feedback.at(-1).applied);

    // something that isn't layout is passed to the developer, not guessed
    const r2 = await request(app).post(`/api/c/${token}/message`).send({ text: 'Can it be in blue?' }).expect(200);
    assert.match(r2.body.project.messages.at(-1).text, /passed that on/);
    assert.ok(!r2.body.project.brief.feedback.at(-1).applied);
  });

  test('regenerate applies the client change requests that are waiting, and accepts a developer instruction', async () => {
    const dev = await devAgent();
    const p = await create(dev);
    const token = tokenOf(p);
    await answerAll(token);
    // simulate a request saved without being applied (e.g. Claude was down)
    const { Project } = await import('../src/models/index.js');
    const doc = await Project.findById(p.id);
    doc.brief.feedback = [{ text: 'Add a Buy now button next to Add to cart' }];
    await doc.save();

    const r = await dev.post(`/api/projects/${p.id}/wireframe`).send({}).expect(200);
    assert.match(r.body.notice, /Applied 1/);
    const items = r.body.project.brief.wireframe.screens.flatMap((s) => s.blocks).find((x) => x.type === 'buttons' && x.items.includes('Add to cart')).items;
    assert.ok(items.includes('Buy now'));
    assert.ok(r.body.project.brief.feedback[0].applied);
    assert.equal(r.body.project.messages.at(-1).kind, 'sketch');

    const r2 = await dev.post(`/api/projects/${p.id}/wireframe`).send({ request: 'remove the reviews section and move the fits these models list to the top' }).expect(200);
    const detail = r2.body.project.brief.wireframe.screens.find((s) => /detail/i.test(s.name));
    assert.equal(detail.blocks[1].title, 'Fits these models');
  });

  test('client can request changes instead of approving; regenerating after sign-off is tracked', async () => {
    const dev = await devAgent();
    const p = await create(dev);
    const token = tokenOf(p);
    await answerAll(token);
    await dev.post(`/api/projects/${p.id}/send`).send({}).expect(200);

    const fb = await request(app).post(`/api/c/${token}/feedback`).send({ text: 'The banner should show our bikes, not parts' });
    assert.equal(fb.status, 200);
    assert.equal(fb.body.project.status, 'review');
    assert.equal(fb.body.project.brief.feedback[0].text, 'The banner should show our bikes, not parts');

    await dev.post(`/api/projects/${p.id}/send`).send({ note: 'Updated banner' }).expect(200);
    await request(app).post(`/api/c/${token}/signoff`).send({ name: 'Mr Tan', agree: true }).expect(200);

    const md = await dev.get(`/api/projects/${p.id}/brief.md`);
    assert.match(md.text, /## Wireframe \(rough layout\)/);
    assert.match(md.text, /Fits these models/);
    assert.match(md.text, /## Client feedback/);

    // the client view includes the wireframe they are approving
    const view = await request(app).get(`/api/c/${token}`);
    assert.ok(view.body.project.brief.wireframe.screens.length >= 1);
  });

  test('Claude wireframe output is cleaned: unknown block types become text', async () => {
    const { cleanWireframe } = await import('../src/services/wireframe.js');
    const wf = cleanWireframe({ device: 'tablet', screens: [{ name: 'Home', purpose: '', blocks: [{ type: 'HERO', title: 'x', text: '', items: [], note: '' }, { type: 'carousel3d', title: 'y', text: '', items: [], note: '' }] }] });
    assert.equal(wf.device, 'mobile');
    assert.deepEqual(wf.screens[0].blocks.map((x) => x.type), ['hero', 'text']);
  });
});
