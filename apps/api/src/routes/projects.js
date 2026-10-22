import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Project } from '../models/index.js';
import {
  briefMarkdown,
  developerQuestion,
  diffAgainstSigned,
  editBrief,
  newToken,
  pickEngine,
  regenerateStories,
  regenerateWireframe,
  sendForSignoff,
  startConversation,
} from '../services/briefs.js';
import { getTemplate, TEMPLATES } from '../services/templates.js';
import { notFound } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

export function projectView(p, { forClient = false } = {}) {
  const t = getTemplate(p.template);
  const brief = p.brief?.toObject ? p.brief.toObject() : p.brief;
  const base = {
    id: String(p._id),
    name: p.name,
    clientName: p.clientName,
    template: { id: t.id, name: t.name, fields: t.fields.map(({ key, label }) => ({ key, label })) },
    status: p.status,
    completeness: p.completeness,
    messages: p.messages,
    brief: { ...brief, fields: Object.fromEntries(p.brief?.fields || []) },
    versions: p.versions.map((v) => ({ n: v.n, createdAt: v.createdAt, note: v.note, signedBy: v.signedBy, signedAt: v.signedAt })),
    signedVersion: p.signedVersion,
    updatedAt: p.updatedAt,
  };
  if (forClient) return base;
  return {
    ...base,
    clientEmail: p.clientEmail,
    initialRequest: p.initialRequest,
    engine: p.engine,
    clientLink: `${config.webUrl}/b/${p.token}`,
    changes: diffAgainstSigned(p),
    createdAt: p.createdAt,
  };
}

async function own(req) {
  const p = await Project.findOne({ _id: req.params.id, owner: req.user._id }).catch(() => null);
  if (!p) throw notFound('Project not found');
  return p;
}

router.get('/meta', (_req, res) => {
  res.json({
    engine: pickEngine().name,
    model: pickEngine().name === 'claude' ? config.ai.model : null,
    templates: Object.values(TEMPLATES).map((t) => ({ id: t.id, name: t.name, fields: t.fields.map((f) => f.label) })),
  });
});

router.get('/', async (req, res) => {
  const list = await Project.find({ owner: req.user._id })
    .sort({ updatedAt: -1 })
    .select('name clientName template status completeness brief.vague brief.openQuestions brief.contradictions updatedAt')
    .lean();
  res.json({
    projects: list.map((p) => ({
      id: String(p._id),
      name: p.name,
      clientName: p.clientName,
      template: getTemplate(p.template).name,
      status: p.status,
      completeness: p.completeness,
      flags: (p.brief?.openQuestions?.length || 0) + (p.brief?.contradictions?.length || 0) + (p.brief?.vague || []).filter((v) => !v.resolved).length,
      updatedAt: p.updatedAt,
    })),
  });
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  clientName: z.string().trim().min(1).max(80),
  clientEmail: z.string().trim().email().optional().or(z.literal('')),
  template: z.enum(Object.keys(TEMPLATES)),
  initialRequest: z.string().trim().max(4000).optional(),
});

router.post('/', validate(createSchema), async (req, res) => {
  const p = await Project.create({ ...req.body, clientEmail: req.body.clientEmail || undefined, owner: req.user._id, token: newToken() });
  await startConversation(p, req.user.name);
  res.status(201).json({ project: projectView(p) });
});

router.get('/:id', async (req, res) => res.json({ project: projectView(await own(req)) }));

router.patch(
  '/:id/brief',
  validate(
    z.object({
      fields: z.record(z.string().max(4000)).optional(),
      summary: z.string().max(4000).optional(),
      stories: z.array(z.object({ asA: z.string(), iWant: z.string(), soThat: z.string(), acceptance: z.array(z.string()) })).optional(),
      risks: z.array(z.string()).optional(),
      assumptions: z.array(z.string()).optional(),
      openQuestions: z.array(z.string()).optional(),
      contradictions: z.array(z.string()).optional(),
    }),
  ),
  async (req, res) => res.json({ project: projectView(await editBrief(await own(req), req.body)) }),
);

router.post('/:id/ask', validate(z.object({ text: z.string().trim().min(3).max(500), options: z.array(z.string().trim().min(1)).max(6).optional() })), async (req, res) => {
  res.json({ project: projectView(await developerQuestion(await own(req), req.body.text, req.body.options)) });
});

router.post('/:id/stories', async (req, res) => res.json({ project: projectView(await regenerateStories(await own(req), req.user.name)) }));

router.post('/:id/wireframe', validate(z.object({ request: z.string().trim().min(3).max(1000).optional() }).default({})), async (req, res) => {
  const { project, notice } = await regenerateWireframe(await own(req), req.user.name, req.body.request);
  res.json({ project: projectView(project), notice });
});

router.post('/:id/send', validate(z.object({ note: z.string().trim().max(500).optional() })), async (req, res) => {
  res.json({ project: projectView(await sendForSignoff(await own(req), req.body.note)) });
});

router.get('/:id/brief.md', async (req, res) => {
  const p = await own(req);
  res.type('text/markdown; charset=utf-8').attachment(`${p.name.replace(/[^\w-]+/g, '-')}-brief.md`).send(briefMarkdown(p));
});

router.delete('/:id', async (req, res) => {
  await (await own(req)).deleteOne();
  res.json({ ok: true });
});

export default router;
