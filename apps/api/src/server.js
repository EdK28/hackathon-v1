import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { pickEngine } from './services/briefs.js';

await connectDb();
createApp().listen(config.port, () => {
  const e = pickEngine().name;
  const hint = e === 'claude' ? ` (${config.ai.model})` : e.startsWith('llm') ? ` at ${config.ai.llm.baseUrl}` : ' (rule-based; set LLM_BASE_URL for a free model or ANTHROPIC_API_KEY for Claude)';
  console.log(`Clarify API on http://localhost:${config.port} · AI engine: ${e}${hint}`);
});
