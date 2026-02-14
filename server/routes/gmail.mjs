import express from 'express';
import {
  createAuthUrl,
  fetchRecentEmails,
  gmailOAuthStatus,
  handleOAuthCallback,
  sendEmail,
  watchInbox,
} from '../lib/gmail.mjs';
import { listLinkedAccountIds } from '../lib/tokenStore.mjs';
import { getPlanLimits } from '../lib/plan.mjs';
import { getRequestPlanType, withRateLimit } from '../lib/rateLimit.mjs';

const router = express.Router();

router.get('/status', (req, res) => {
  res.json(gmailOAuthStatus());
});

router.get('/auth-url', async (req, res) => {
  const accountId = String(req.query.accountId || '').trim();
  const redirectUri = req.query.redirectUri
    ? String(req.query.redirectUri)
    : undefined;

  if (!accountId) {
    res.status(400).json({ error: 'accountId_required' });
    return;
  }

  try {
    const planType = getRequestPlanType(req);
    const limits = getPlanLimits(planType);

    const linkedIds = await listLinkedAccountIds();
    const alreadyLinked = linkedIds.includes(accountId);
    if (!alreadyLinked && linkedIds.length >= limits.maxAccounts) {
      res.status(403).json({
        error: 'plan_account_limit_reached',
        planType,
        maxAccounts: limits.maxAccounts,
      });
      return;
    }

    const { authUrl } = createAuthUrl({
      accountId,
      redirectUri,
      forceConsent: true,
    });

    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({
      error: 'failed_to_generate_auth_url',
      details: error instanceof Error ? error.message : 'unknown_error',
    });
  }
});

router.get('/oauth/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');

  if (!code || !state) {
    res.status(400).send('Missing code/state in callback');
    return;
  }

  try {
    const result = await handleOAuthCallback({ code, state });

    res.status(200).send(`
      <html>
        <body style="font-family: Arial; background:#111; color:#e3e3e3; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
          <div style="max-width:420px; padding:24px; border:1px solid #444746; border-radius:16px; background:#1e1f20;">
            <h2 style="margin-top:0;">Tavelli Gmail Connected</h2>
            <p>Account: <b>${result.accountId}</b></p>
            <p>You can return to Tavelli app.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`OAuth callback failed: ${error instanceof Error ? error.message : 'unknown_error'}`);
  }
});

router.get('/messages', withRateLimit('gmailReadDaily'), async (req, res) => {
  const accountId = String(req.query.accountId || '').trim();
  const limit = Number.parseInt(String(req.query.limit || '10'), 10);

  if (!accountId) {
    res.status(400).json({ error: 'accountId_required' });
    return;
  }

  try {
    const emails = await fetchRecentEmails({
      accountId,
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 10,
    });

    res.json({ emails });
  } catch (error) {
    res.status(500).json({
      error: 'gmail_fetch_failed',
      details: error instanceof Error ? error.message : 'unknown_error',
    });
  }
});

router.post('/watch', withRateLimit('gmailWatchDaily'), async (req, res) => {
  const accountId = String(req.body?.accountId || '').trim();
  if (!accountId) {
    res.status(400).json({ error: 'accountId_required' });
    return;
  }

  try {
    const watch = await watchInbox({ accountId });
    res.json({ subscribed: true, ...watch });
  } catch (error) {
    res.status(500).json({
      error: 'gmail_watch_failed',
      details: error instanceof Error ? error.message : 'unknown_error',
    });
  }
});

router.post('/send', withRateLimit('gmailSendDaily'), async (req, res) => {
  const accountId = String(req.body?.accountId || '').trim();
  const to = String(req.body?.to || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();

  if (!accountId || !to || !subject || !body) {
    res.status(400).json({ error: 'accountId_to_subject_body_required' });
    return;
  }

  try {
    const result = await sendEmail({
      accountId,
      to,
      subject,
      bodyHtml: body,
    });

    res.json({ sent: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: 'gmail_send_failed',
      details: error instanceof Error ? error.message : 'unknown_error',
    });
  }
});

export default router;
