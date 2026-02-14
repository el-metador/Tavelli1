import express from 'express';
import cors from 'cors';
import { config } from './lib/config.mjs';
import { cacheHealth, initCache } from './lib/cache.mjs';
import aiRoutes from './routes/ai.mjs';
import gmailRoutes from './routes/gmail.mjs';
import supabaseRoutes from './routes/supabase.mjs';

const app = express();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (config.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS not allowed'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'tavelli-api',
    cache: cacheHealth(),
    ts: new Date().toISOString(),
  });
});

app.use('/api/ai', aiRoutes);
app.use('/api/integrations/gmail', gmailRoutes);
app.use('/api/auth/supabase', supabaseRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.use((error, req, res, next) => {
  res.status(500).json({
    error: 'internal_server_error',
    details: error instanceof Error ? error.message : 'unknown_error',
  });
});

const start = async () => {
  await initCache(config.cache.redisUrl);

  app.listen(config.port, () => {
    console.log(`[tavelli-api] listening on :${config.port}`);
  });
};

start().catch((error) => {
  console.error('[tavelli-api] failed to start', error);
  process.exit(1);
});
