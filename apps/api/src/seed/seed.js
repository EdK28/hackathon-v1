/* Demo data. Run: npm run seed  (wipes the Clarify database) */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { Project, User } from '../models/index.js';
import { clientAnswer, editBrief, newToken, sendForSignoff, signOff, startConversation } from '../services/briefs.js';

config.ai.engine = 'offline'; // seed must be deterministic and free

const SCRIPT = {
  goal: { selected: ['Get more sales or orders online', 'Reduce manual work for staff'] },
  audience: { selected: ['Retail customers', 'Mobile phone users mostly'] },
  problem: { other: 'website not nice' },
  detail: { other: 'Customers WhatsApp us 20-30 times a day to ask if a part fits their bike, because product pages do not show which models it fits.' },
  pages: { selected: ['Home page', 'Product detail page'] },
  mustHaves: { selected: ['Online payment', 'Product search', 'WhatsApp contact'] },
  references: { other: 'make it modern like NVIDIA' },
  content: { selected: ['We have some, need help with the rest'] },
  integrations: { selected: ['Payment gateway (e.g. FPX)', 'Courier / shipping'] },
  deadline: { selected: ['In 1–3 months'] },
  success: { selected: ['More online orders', 'Fewer WhatsApp/phone enquiries'] },
  outOfScope: { selected: ['Mobile app'] },
  look: { selected: ['Keep our current brand colours', 'Bold, large photos'] },
  budget: { selected: ['RM 15,000 – 50,000'] },
  followup: { selected: ['Big, bold photos', 'Fewer steps to buy'] },
};

async function answerUntil(p, devName, stopAfter = Infinity) {
  for (let i = 0; i < stopAfter && p.status === 'gathering'; i++) {
    const key = p.pending.kind === 'field' ? p.pending.field : p.pending.kind;
    await clientAnswer(p, SCRIPT[key] || { other: 'Not sure yet' }, devName);
  }
}

async function main() {
  await connectDb();
  await mongoose.connection.dropDatabase();
  for (const m of [User, Project]) {
    await m.createCollection().catch(() => {});
    await m.syncIndexes();
  }
  const dev = await User.create({ name: 'Edward', email: 'dev@demo.local', passwordHash: await bcrypt.hash('Clarify123!', 10) });
  const make = (data) => Project.create({ owner: dev._id, token: newToken(), ...data });

  // 1. Just started: client has answered a few questions
  const a = await make({
    name: 'Online booking for service appointments',
    clientName: 'Puan Aishah',
    template: 'new-site',
    initialRequest: 'We want customers to book service online, something simple and user friendly like Grab. ASAP please.',
  });
  await startConversation(a, dev.name);
  await answerUntil(a, dev.name, 3);

  // 2. Finished interview, waiting for developer review
  const b = await make({
    name: 'Zontes shop homepage refresh',
    clientName: 'Mr Tan (ZONTES Malaysia)',
    template: 'redesign',
    initialRequest: 'Can you make the homepage more modern? The website is not nice.',
  });
  await startConversation(b, dev.name);
  await answerUntil(b, dev.name);

  // 3. Signed off, then the developer changed the deadline (shows change tracking)
  const c = await make({
    name: 'Fitment checker on product pages',
    clientName: 'Mr Tan (ZONTES Malaysia)',
    template: 'feature',
    initialRequest: 'Customers keep asking if parts fit. Improve the product page.',
  });
  await startConversation(c, dev.name);
  await answerUntil(c, dev.name);
  await sendForSignoff(c, 'First version for approval');
  await signOff(c, { name: 'Tan Wei Ming' });
  await editBrief(c, { fields: { deadline: 'Within a month (client asked to bring forward)' } });

  console.log('Seeded 3 projects. Login: dev@demo.local / Clarify123!');
  console.log(`Client link for the in-progress project: ${config.webUrl}/b/${a.token}`);
  await disconnectDb();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDb();
  process.exit(1);
});
