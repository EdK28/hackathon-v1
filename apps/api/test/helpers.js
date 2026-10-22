import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb } from '../src/db.js';
import { Project, User } from '../src/models/index.js';

export const TEST_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/clarify_test?replicaSet=rs0';
export const app = createApp({ logging: false });

export async function setup() {
  if (mongoose.connection.readyState !== 1) await connectDb(TEST_URI);
  await mongoose.connection.dropDatabase();
  for (const m of [User, Project]) {
    await m.createCollection().catch(() => {});
    await m.syncIndexes();
  }
}

export async function devAgent(email = 'dev@t.local') {
  const agent = request.agent(app);
  const r = await agent.post('/api/auth/register').send({ name: 'Edward', email, password: 'Password1!' });
  if (r.status !== 201) throw new Error(r.text);
  return agent;
}

/** Answers for a vague but realistic client, keyed by what the assistant is asking about. */
export const VAGUE_CLIENT = {
  goal: { selected: ['Get more sales or orders online'] },
  audience: { selected: ['Retail customers', 'Mobile phone users mostly'] },
  problem: { other: 'website not nice' }, // too thin -> should ask for an example
  detail: { other: 'Customers WhatsApp us to ask if parts fit their bike because the product page does not say which models it fits' },
  pages: { selected: ['Home page', 'Product detail page'] },
  mustHaves: { selected: ['Online payment', 'Product search', 'Customer accounts & order history', 'Admin dashboard / reports', 'WhatsApp contact'] },
  references: { other: 'make it modern like NVIDIA' }, // vague -> follow-up
  content: { selected: ['We have some, need help with the rest'] },
  integrations: { selected: ['Payment gateway (e.g. FPX)'] },
  deadline: { selected: ['Within 2 weeks'] }, // with 5 must-haves -> contradiction
  success: { selected: ['More online orders', 'Fewer WhatsApp/phone enquiries'] },
  outOfScope: { selected: ['Mobile app'] },
  followup: { selected: ['Big, bold photos', 'Smooth animations'] },
};

export async function answerAll(token, script = VAGUE_CLIENT, max = 40) {
  const asked = [];
  for (let i = 0; i < max; i++) {
    const p = await Project.findOne({ token });
    if (p.status !== 'gathering') return { asked, project: p };
    const key = p.pending.kind === 'field' ? p.pending.field : p.pending.kind; // detail | followup
    asked.push(p.pending.kind === 'followup' ? `followup:${p.pending.term}` : key);
    const body = script[key] || { other: 'Not sure yet' };
    const r = await request(app).post(`/api/c/${token}/answer`).send(body);
    if (r.status !== 200) throw new Error(`answer failed ${r.status} ${r.text}`);
  }
  throw new Error('conversation did not finish');
}
