import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { pickEngine } from './services/briefs.js';

await connectDb();
createApp().listen(config.port, () => {
  const e = pickEngine().name;
  console.log(`Clarify API on http://localhost:${config.port} · AI engine: ${e}${e === 'claude' ? ` (${config.ai.model})` : ' (set ANTHROPIC_API_KEY to use Claude)'}`);
});
