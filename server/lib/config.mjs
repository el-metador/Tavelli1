import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const parseCsv = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const defaultAllowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export const config = {
  port: Number.parseInt(process.env.API_PORT || '8787', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  allowedOrigins: parseCsv(process.env.ALLOWED_ORIGINS).length
    ? parseCsv(process.env.ALLOWED_ORIGINS)
    : defaultAllowedOrigins,
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID || '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
    redirectUri:
      process.env.GMAIL_REDIRECT_URI ||
      'http://localhost:8787/api/integrations/gmail/oauth/callback',
    pubsubTopic: process.env.GMAIL_PUBSUB_TOPIC || '',
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    groqApiKey: process.env.GROQ_API_KEY || '',
    defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'gemini',
  },
  cache: {
    redisUrl: process.env.REDIS_URL || '',
    defaultTtlSeconds: Number.parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  },
  supabase: {
    url: process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '',
    anonKey:
      process.env.SUPABASE_ANON_KEY ||
      process.env.REACT_APP_SUPABASE_ANON_KEY ||
      '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  security: {
    oauthStateSecret:
      process.env.OAUTH_STATE_SECRET || crypto.randomBytes(32).toString('hex'),
  },
};

export const missingGmailOAuthConfig = () =>
  !config.gmail.clientId || !config.gmail.clientSecret;

export const missingSupabaseConfig = () =>
  !config.supabase.url || !config.supabase.anonKey;
