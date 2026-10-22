import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { Project, User } from '../models/index.js';
import { clientAnswer, clientFeedback, clientMessage, signOff, wireframeLooksRight } from '../services/briefs.js';
import { notFound } from '../utils/errors.js';
import { projectView } from './projects.js';

/** Routes for the client. No login: the unguessable link token is the key. */
const router = Router();

async function byToken(req) {
  const p = await Project.findOne({ token: req.params.token });
  if (!p) throw notFound('This link is not valid. Please ask for a new one.');
  const dev = await User.findById(p.owner).lean();
  return { p, developerName: dev?.name };
}

const view = (p, developerName) => ({ ...projectView(p, { forClient: true }), developerName });

router.get('/:token', async (req, res) => {
  const { p, developerName } = await byToken(req);
  res.json({ project: view(p, developerName) });
});

router.post(
  '/:token/answer',
  validate(z.object({ selected: z.array(z.string().max(300)).max(10).default([]), other: z.string().trim().max(3000).optional().default('') })),
  async (req, res) => {
    const { p, developerName } = await byToken(req);
    await clientAnswer(p, req.body, developerName);
    res.json({ project: view(p, developerName) });
  },
);

router.post('/:token/signoff', validate(z.object({ name: z.string().trim().min(2).max(80), agree: z.literal(true) })), async (req, res) => {
  const { p, developerName } = await byToken(req);
  await signOff(p, req.body);
  res.json({ project: view(p, developerName) });
});

router.post('/:token/feedback', validate(z.object({ text: z.string().trim().min(3).max(2000) })), async (req, res) => {
  const { p, developerName } = await byToken(req);
  await clientFeedback(p, req.body.text, developerName);
  res.json({ project: view(p, developerName) });
});

router.post('/:token/message', validate(z.object({ text: z.string().trim().min(1).max(2000) })), async (req, res) => {
  const { p, developerName } = await byToken(req);
  await clientMessage(p, req.body.text, developerName);
  res.json({ project: view(p, developerName) });
});

router.post('/:token/wireframe-ok', async (req, res) => {
  const { p, developerName } = await byToken(req);
  await wireframeLooksRight(p, developerName);
  res.json({ project: view(p, developerName) });
});

export default router;
