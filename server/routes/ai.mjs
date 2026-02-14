import express from 'express';
import { config } from '../lib/config.mjs';
import { getCache, setCache } from '../lib/cache.mjs';
import {
  analyzeEmailWithProvider,
  generateDraftWithProvider,
  generateNewEmailWithProvider,
  hashAnalysisInput,
} from '../lib/aiProviders.mjs';
import { getRequestPlanType, withRateLimit } from '../lib/rateLimit.mjs';

const router = express.Router();

router.post('/analyze-email', withRateLimit('aiAnalyzeDaily'), async (req, res) => {
  const email = req.body?.email;
  const provider = req.body?.provider || config.ai.defaultProvider;
  const customPrompt = req.body?.customPrompt || '';
  const planType = getRequestPlanType(req);

  if (!email || typeof email !== 'object') {
    res.status(400).json({ error: 'email_payload_required' });
    return;
  }

  const hash = hashAnalysisInput({ provider, email, customPrompt, planType });
  const cacheKey = `ai:analyze:${hash}`;

  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json({ cached: true, result: cached });
      return;
    }

    const result = await analyzeEmailWithProvider({
      email,
      provider,
      customPrompt,
    });

    await setCache(cacheKey, result, config.cache.defaultTtlSeconds);
    res.json({ cached: false, result });
  } catch (error) {
    res.status(500).json({
      error: 'ai_analyze_failed',
      details: error instanceof Error ? error.message : 'unknown_error',
    });
  }
});

router.post('/generate-draft', withRateLimit('aiDraftDaily'), async (req, res) => {
  const email = req.body?.email;
  const tone = req.body?.tone || 'standard';
  const provider = req.body?.provider || config.ai.defaultProvider;

  if (!email || typeof email !== 'object') {
    res.status(400).json({ error: 'email_payload_required' });
    return;
  }

  try {
    const text = await generateDraftWithProvider({ email, tone, provider });
    res.json({ text });
  } catch (error) {
    res.status(500).json({
      error: 'ai_draft_failed',
      details: error instanceof Error ? error.message : 'unknown_error',
    });
  }
});

router.post('/new-email-draft', withRateLimit('aiDraftDaily'), async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  const provider = req.body?.provider || config.ai.defaultProvider;

  if (!prompt) {
    res.status(400).json({ error: 'prompt_required' });
    return;
  }

  try {
    const result = await generateNewEmailWithProvider({ prompt, provider });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'ai_new_draft_failed',
      details: error instanceof Error ? error.message : 'unknown_error',
    });
  }
});

export default router;
