import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { COOKIE_NAME, setAuthCookie, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { User } from '../models/index.js';
import { conflict, unauthorized } from '../utils/errors.js';

const router = Router();
const pub = (u) => (u ? { id: String(u._id), name: u.name, email: u.email } : null);

router.post(
  '/register',
  validate(z.object({ name: z.string().trim().min(2), email: z.string().trim().email(), password: z.string().min(8) })),
  async (req, res) => {
    if (await User.exists({ email: req.body.email.toLowerCase() })) throw conflict('An account with this email already exists');
    const user = await User.create({ ...req.body, passwordHash: await bcrypt.hash(req.body.password, 10) });
    setAuthCookie(res, signToken(user));
    res.status(201).json({ user: pub(user) });
  },
);

router.post('/login', validate(z.object({ email: z.string().trim().email(), password: z.string().min(1) })), async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw unauthorized('Incorrect email or password');
  setAuthCookie(res, signToken(user));
  res.json({ user: pub(user) });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => res.json({ user: pub(req.user) }));

export default router;
