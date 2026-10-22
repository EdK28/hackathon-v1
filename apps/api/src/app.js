import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, isProd } from './config.js';
import { loadUser } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/client.js';
import projectRoutes from './routes/projects.js';
import { HttpError } from './utils/errors.js';

export function createApp({ logging = !isProd && process.env.NODE_ENV !== 'test' } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.webUrl, credentials: true }));
  if (logging) app.use(morgan('dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(loadUser);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/c', clientRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid data', details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })) });
    }
    if (err?.code === 11000) return res.status(409).json({ error: 'Duplicate value', details: err.keyValue });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}
