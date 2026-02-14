import express from 'express';
import {
  getSupabaseAdmin,
  getSupabaseStatus,
  requireSupabaseAuth,
} from '../lib/supabase.mjs';

const router = express.Router();

router.get('/status', (req, res) => {
  res.json(getSupabaseStatus());
});

router.get('/me', requireSupabaseAuth, async (req, res) => {
  const user = req.supabaseUser;

  res.json({
    id: user.id,
    email: user.email || '',
    userMetadata: user.user_metadata || {},
    appMetadata: user.app_metadata || {},
  });
});

router.get('/profile', requireSupabaseAuth, async (req, res) => {
  const user = req.supabaseUser;
  const admin = getSupabaseAdmin();

  if (!admin) {
    res.json({
      profile: {
        id: user.id,
        email: user.email || '',
        full_name:
          user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
      },
      source: 'auth_metadata',
    });
    return;
  }

  try {
    const { data } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    res.json({
      profile:
        data || {
          id: user.id,
          email: user.email || '',
          full_name:
            user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      source: data ? 'db' : 'auth_metadata',
    });
  } catch (error) {
    res.status(500).json({
      error: 'profile_fetch_failed',
      details: error instanceof Error ? error.message : 'unknown_error',
    });
  }
});

router.put('/profile', requireSupabaseAuth, async (req, res) => {
  const user = req.supabaseUser;
  const admin = getSupabaseAdmin();

  if (!admin) {
    res.status(503).json({
      error: 'supabase_service_role_missing',
      details: 'Set SUPABASE_SERVICE_ROLE_KEY for profile writes',
    });
    return;
  }

  const payload = {
    id: user.id,
    email: user.email || '',
    full_name: req.body?.fullName || user.user_metadata?.full_name || user.user_metadata?.name || null,
    avatar_url: req.body?.avatarUrl || user.user_metadata?.avatar_url || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data } = await admin
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    res.json({
      saved: true,
      profile: data,
    });
  } catch (error) {
    res.status(500).json({
      error: 'profile_upsert_failed',
      details: error instanceof Error ? error.message : 'unknown_error',
    });
  }
});

export default router;
