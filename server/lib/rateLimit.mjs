import { incrementCounter } from './cache.mjs';
import { getPlanLimits, normalizePlanType } from './plan.mjs';

const secondsUntilDayEnd = () => {
  const now = new Date();
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000));
};

const getIdentity = (req) =>
  req.get('x-user-id') ||
  req.body?.userId ||
  req.query?.userId ||
  req.get('x-account-id') ||
  req.body?.accountId ||
  req.query?.accountId ||
  req.ip ||
  'anonymous';

export const getRequestPlanType = (req) =>
  normalizePlanType(
    req.get('x-plan-type') || req.body?.planType || req.query?.planType || 'FREE'
  );

export const withRateLimit = (featureKey) => async (req, res, next) => {
  const planType = getRequestPlanType(req);
  const limits = getPlanLimits(planType);
  const limit = limits[featureKey];

  if (!limit || !Number.isFinite(limit)) {
    next();
    return;
  }

  const identity = getIdentity(req);
  const cacheKey = `rl:${featureKey}:${planType}:${identity}`;
  const used = await incrementCounter(cacheKey, secondsUntilDayEnd());

  res.setHeader('x-rate-limit-limit', String(limit));
  res.setHeader('x-rate-limit-remaining', String(Math.max(0, limit - used)));
  res.setHeader('x-rate-limit-plan', planType);

  if (used > limit) {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      feature: featureKey,
      planType,
      limit,
    });
    return;
  }

  next();
};
