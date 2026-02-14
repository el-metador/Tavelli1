import { createClient } from '@supabase/supabase-js';
import { config, missingSupabaseConfig } from './config.mjs';

const baseConfig = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

const authClient =
  config.supabase.url && config.supabase.anonKey
    ? createClient(config.supabase.url, config.supabase.anonKey, baseConfig)
    : null;

const adminClient =
  config.supabase.url && config.supabase.serviceRoleKey
    ? createClient(config.supabase.url, config.supabase.serviceRoleKey, baseConfig)
    : null;

export const getSupabaseAdmin = () => adminClient;

export const getSupabaseStatus = () => ({
  configured: !missingSupabaseConfig(),
  adminConfigured: Boolean(adminClient),
  url: config.supabase.url ? '[set]' : '',
});

const getBearerToken = (req) => {
  const header = String(req.get('authorization') || '');
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

export const requireSupabaseAuth = async (req, res, next) => {
  if (!authClient) {
    res.status(503).json({
      error: 'supabase_not_configured',
      details: 'Set SUPABASE_URL and SUPABASE_ANON_KEY',
    });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'missing_bearer_token' });
    return;
  }

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({
      error: 'invalid_auth_token',
      details: error?.message || 'Could not resolve user from token',
    });
    return;
  }

  req.supabaseUser = data.user;
  next();
};
