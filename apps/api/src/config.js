const env = process.env;

export const config = {
  port: Number(env.PORT || 4100),
  mongoUri: env.MONGO_URI || 'mongodb://127.0.0.1:27017/clarify?replicaSet=rs0',
  jwtSecret: env.JWT_SECRET || 'dev-only-change-me',
  webUrl: env.WEB_URL || 'http://localhost:3100',
  cookieSecure: env.COOKIE_SECURE === 'true',

  ai: {
    // 'auto' uses Claude when ANTHROPIC_API_KEY is set, else a free/open model when LLM_BASE_URL is set,
    // else the offline (rule-based) engine.
    engine: env.AI_ENGINE || 'auto', // 'auto' | 'claude' | 'llm' | 'offline'
    apiKey: env.ANTHROPIC_API_KEY || '',
    model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    // Any OpenAI-compatible API: Ollama (local, free), Groq, OpenRouter...
    llm: {
      baseUrl: env.LLM_BASE_URL || '',
      apiKey: env.LLM_API_KEY || '',
      model: env.LLM_MODEL || '',
      timeoutMs: Number(env.LLM_TIMEOUT_MS || 180_000), // local models can be slow on the first call
    },
  },
};

export const isProd = env.NODE_ENV === 'production';
if (isProd && config.jwtSecret === 'dev-only-change-me') throw new Error('JWT_SECRET must be set in production');
