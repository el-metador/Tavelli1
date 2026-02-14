export const PLAN_TYPES = ['FREE', 'PRO', 'ENTERPRISE'];

export const PLAN_LIMITS = {
  FREE: {
    maxAccounts: 1,
    aiAnalyzeDaily: 120,
    aiDraftDaily: 80,
    gmailReadDaily: 200,
    gmailSendDaily: 30,
    gmailWatchDaily: 10,
  },
  PRO: {
    maxAccounts: 3,
    aiAnalyzeDaily: 2000,
    aiDraftDaily: 1000,
    gmailReadDaily: 3000,
    gmailSendDaily: 400,
    gmailWatchDaily: 60,
  },
  ENTERPRISE: {
    maxAccounts: 10,
    aiAnalyzeDaily: 10000,
    aiDraftDaily: 6000,
    gmailReadDaily: 20000,
    gmailSendDaily: 2500,
    gmailWatchDaily: 500,
  },
};

export const normalizePlanType = (value) => {
  const up = String(value || '').toUpperCase();
  return PLAN_TYPES.includes(up) ? up : 'FREE';
};

export const getPlanLimits = (planType) => PLAN_LIMITS[normalizePlanType(planType)];
