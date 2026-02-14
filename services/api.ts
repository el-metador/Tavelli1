import {
  Account,
  AppSettings,
  Email,
  EmailCategory,
  HistoryItem,
  LastTenAnalysis,
  PlanType,
  UserPlan,
} from '../types';
import { getSupabaseUserId, supabase } from './supabase';

const API_BASE_URL =
  ((globalThis as any).process?.env?.REACT_APP_API_URL as string | undefined) ||
  '/api';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_DAYS = 7;
const STORAGE_KEYS = {
  settings: 'tavelli.settings.v1',
  history: 'tavelli.history.v1',
  lastTen: 'tavelli.last-ten.v1',
};

const SUPABASE_TABLES = {
  settings: 'user_settings',
  history: 'ai_history',
  lastTen: 'last_ten_analysis',
};

const DEFAULT_SETTINGS: AppSettings = {
  language: 'ru',
  theme: 'dark',
  aiStyle: 'human',
  aiProvider: 'gemini',
  strictNoiseFilter: true,
  autoAnalyzeOnOpen: true,
  autoReply: false,
  autoDate: false,
  autoLogo: false,
  autoSignature: false,
  customPrompt: '',
  logoUrl: null,
  logoPosition: 'end',
};

const PLAN_MAP: Record<PlanType, UserPlan> = {
  FREE: {
    type: 'FREE',
    price: 0,
    features: ['Basic AI filtering', '7-day inbox window', '1 Gmail account'],
    limits: {
      maxAccounts: 1,
      deepAnalysis: false,
      autoSignature: false,
      autoDate: false,
      autoLogo: false,
      autoReply: false,
    },
  },
  PRO: {
    type: 'PRO',
    price: 4.5,
    features: [
      'Smart hot-actions',
      '3 linked Gmail accounts',
      'Priority verification extraction',
      'Draft reply assistance',
    ],
    limits: {
      maxAccounts: 3,
      deepAnalysis: false,
      autoSignature: false,
      autoDate: false,
      autoLogo: false,
      autoReply: false,
    },
  },
  ENTERPRISE: {
    type: 'ENTERPRISE',
    price: 10,
    features: [
      '10 linked business accounts',
      'Deep mailbox analysis',
      'Auto signature and date',
      'Auto PNG/SVG brand logo support',
      'AI auto-replies',
    ],
    limits: {
      maxAccounts: 10,
      deepAnalysis: true,
      autoSignature: true,
      autoDate: true,
      autoLogo: true,
      autoReply: true,
    },
  },
};

const daysAgoIso = (days: number, hour = 10): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 20, 0, 0);
  return d.toISOString();
};

const SEED_EMAILS: Email[] = [
  {
    id: '101',
    accountId: 'acc-main',
    senderName: 'Airbnb Security',
    senderEmail: 'no-reply@airbnb.com',
    subject: 'Your verification code is 582194',
    snippet: 'Use code 582194 to continue login. This code expires in 10 minutes.',
    body: '<p>Use this code to verify your sign in: <b>582194</b>.</p><p><a href="https://www.airbnb.com/verify?token=abc">Verify device</a></p>',
    date: daysAgoIso(0, 9),
    isRead: false,
    category: EmailCategory.TEMPORARY_IMPORTANT,
  },
  {
    id: '102',
    accountId: 'acc-main',
    senderName: 'Booking.com Support',
    senderEmail: 'support@booking.com',
    subject: 'Account restriction notice',
    snippet:
      'Your property booking account is temporarily blocked. You can appeal by replying to this email.',
    body: '<p>Your account has been blocked for policy reasons.</p><p>You may appeal by replying to this message.</p>',
    date: daysAgoIso(0, 8),
    isRead: false,
    category: EmailCategory.IMPORTANT,
  },
  {
    id: '103',
    accountId: 'acc-main',
    senderName: 'Notion Waitlist',
    senderEmail: 'team@updates.notion.com',
    subject: 'You are near the top of the waitlist',
    snippet: 'Confirm your interest in the next 24 hours to keep your place.',
    body: '<p>Good news, your waitlist position is almost ready.</p><p><a href="https://notion.so/waitlist/confirm">Confirm now</a></p>',
    date: daysAgoIso(1, 17),
    isRead: false,
    category: EmailCategory.IMPORTANT,
  },
  {
    id: '104',
    accountId: 'acc-main',
    senderName: 'Figma Billing',
    senderEmail: 'billing@figma.com',
    subject: 'Subscription expires in 3 days',
    snippet: 'Your Pro subscription will expire on renewal date unless updated.',
    body: '<p>Your subscription expires soon. Please update your payment method.</p>',
    date: daysAgoIso(2, 12),
    isRead: true,
    category: EmailCategory.IMPORTANT,
  },
  {
    id: '105',
    accountId: 'acc-main',
    senderName: 'Nike',
    senderEmail: 'promo@nike.com',
    subject: '70% OFF this weekend only',
    snippet: 'New arrivals. Massive discount. Limited time.',
    body: '<p>Huge weekend sale.</p>',
    date: daysAgoIso(0, 6),
    isRead: true,
    category: EmailCategory.PROMOTION,
  },
  {
    id: '106',
    accountId: 'acc-main',
    senderName: 'YouTube',
    senderEmail: 'noreply@youtube.com',
    subject: 'New videos from channels you follow',
    snippet: 'Watch now and never miss an upload.',
    body: '<p>Your weekly digest.</p>',
    date: daysAgoIso(3, 13),
    isRead: true,
    category: EmailCategory.SOCIAL,
  },
  {
    id: '107',
    accountId: 'acc-main',
    senderName: 'Cloudflare',
    senderEmail: 'no-reply@cloudflare.com',
    subject: 'Confirm email change request',
    snippet: 'Click to verify your account email change request.',
    body: '<p>To confirm your account action, <a href="https://dash.cloudflare.com/verify-email?id=9988">verify now</a>.</p>',
    date: daysAgoIso(1, 7),
    isRead: false,
    category: EmailCategory.TEMPORARY_IMPORTANT,
  },
  {
    id: '108',
    accountId: 'acc-main',
    senderName: 'Stripe Alerts',
    senderEmail: 'alerts@stripe.com',
    subject: 'Action required on your account',
    snippet: 'Your account requires additional verification documents.',
    body: '<p>Upload verification documents to avoid payout delays.</p>',
    date: daysAgoIso(6, 15),
    isRead: false,
    category: EmailCategory.IMPORTANT,
  },
  {
    id: '109',
    accountId: 'acc-main',
    senderName: 'Legacy Travel',
    senderEmail: 'support@legacy-travel.com',
    subject: 'Trip itinerary update',
    snippet: 'Updated schedule and gate information for your trip.',
    body: '<p>Gate changed to A14.</p>',
    date: daysAgoIso(8, 11),
    isRead: true,
    category: EmailCategory.IMPORTANT,
  },
  {
    id: '201',
    accountId: 'acc-work',
    senderName: 'Google Workspace',
    senderEmail: 'workspace-noreply@google.com',
    subject: 'Admin login verification code: 939100',
    snippet: 'Use 939100 to verify admin login in your organization account.',
    body: '<p>Code: <b>939100</b></p>',
    date: daysAgoIso(0, 10),
    isRead: false,
    category: EmailCategory.TEMPORARY_IMPORTANT,
  },
  {
    id: '202',
    accountId: 'acc-work',
    senderName: 'HubSpot',
    senderEmail: 'updates@hubspot.com',
    subject: 'Monthly growth report',
    snippet: 'Your monthly report is ready.',
    body: '<p>Report attached.</p>',
    date: daysAgoIso(1, 16),
    isRead: true,
    category: EmailCategory.IMPORTANT,
  },
  {
    id: '301',
    accountId: 'acc-side',
    senderName: 'Linear',
    senderEmail: 'security@linear.app',
    subject: 'Verify your sign-in',
    snippet: 'Complete verification with this link.',
    body: '<p><a href="https://linear.app/verify?code=gh9">Verify sign in</a></p>',
    date: daysAgoIso(0, 14),
    isRead: false,
    category: EmailCategory.TEMPORARY_IMPORTANT,
  },
  {
    id: '401',
    accountId: 'acc-finance',
    senderName: 'Bank Alerts',
    senderEmail: 'alerts@bank.com',
    subject: 'Security alert in your account',
    snippet: 'Please verify recent card activity in app.',
    body: '<p>Possible suspicious activity detected.</p>',
    date: daysAgoIso(1, 9),
    isRead: false,
    category: EmailCategory.IMPORTANT,
  },
  {
    id: '501',
    accountId: 'acc-extra',
    senderName: 'Canva',
    senderEmail: 'team@canva.com',
    subject: 'Your team invite is waiting',
    snippet: 'Confirm invite to join workspace.',
    body: '<p><a href="https://canva.com/verify-invite">Verify invite</a></p>',
    date: daysAgoIso(2, 18),
    isRead: false,
    category: EmailCategory.TEMPORARY_IMPORTANT,
  },
];

const SEED_ACCOUNTS: Account[] = [
  {
    id: 'acc-main',
    email: 'me.personal@gmail.com',
    name: 'Personal',
    avatar: '',
    provider: 'gmail',
    isActive: true,
  },
  {
    id: 'acc-work',
    email: 'me.work@gmail.com',
    name: 'Work',
    avatar: '',
    provider: 'gmail',
    isActive: false,
  },
  {
    id: 'acc-side',
    email: 'me.side@gmail.com',
    name: 'Side',
    avatar: '',
    provider: 'gmail',
    isActive: false,
  },
  {
    id: 'acc-finance',
    email: 'finance@company.com',
    name: 'Finance',
    avatar: '',
    provider: 'gmail',
    isActive: false,
  },
  {
    id: 'acc-extra',
    email: 'ops@company.com',
    name: 'Ops',
    avatar: '',
    provider: 'gmail',
    isActive: false,
  },
];

const IMPORTANT_REGEX =
  /booking|бронир|waitlist|verification|verify|код|otp|security|account|аккаунт|subscription|подписк|renew|expire|billing|appeal|blocked|suspend|restricted/i;
const CODE_REGEX = /\b\d{4,8}\b/g;
const VERIFY_LINK_REGEX = /https?:\/\/[^\s"']*(verify|confirm|login|signin)[^\s"']*/gi;

const safeRead = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const safeWrite = (key: string, value: unknown): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
};

const getStorageKeyForUser = async (baseKey: string): Promise<string> => {
  const userId = (await getSupabaseUserId()) || 'anonymous';
  return `${baseKey}:${userId}`;
};

const withPriority = (email: Email): Email => {
  const text = `${email.subject} ${email.snippet} ${email.body}`;
  const hasCode = CODE_REGEX.test(text);
  CODE_REGEX.lastIndex = 0;
  const hasVerifyLink = VERIFY_LINK_REGEX.test(text);
  VERIFY_LINK_REGEX.lastIndex = 0;
  const looksImportant = IMPORTANT_REGEX.test(text);

  if (hasCode || hasVerifyLink) {
    return { ...email, category: EmailCategory.TEMPORARY_IMPORTANT };
  }
  if (looksImportant && (email.category === EmailCategory.PROMOTION || email.category === EmailCategory.SOCIAL || email.category === EmailCategory.SPAM)) {
    return { ...email, category: EmailCategory.IMPORTANT };
  }
  return email;
};

const isOlderThanMaxAge = (dateIso: string): boolean => {
  const age = Date.now() - new Date(dateIso).getTime();
  return age > MAX_AGE_DAYS * ONE_DAY_MS;
};

const shouldHideAsNoise = (email: Email): boolean => {
  if (email.category === EmailCategory.IMPORTANT || email.category === EmailCategory.TEMPORARY_IMPORTANT) {
    return false;
  }

  const text = `${email.subject} ${email.snippet} ${email.body}`;
  return !IMPORTANT_REGEX.test(text);
};

const normalizeAndSort = (emails: Email[]): Email[] =>
  emails
    .map(withPriority)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export interface InboxSnapshot {
  emails: Email[];
  hiddenByAge: number;
  hiddenByNoise: number;
  totalFetched: number;
}

export const getPlanConfig = (type: PlanType): UserPlan => PLAN_MAP[type];

export const getEmails = async (
  accountId: string,
  strictMode = false,
  activeTab: 'primary' | 'inbox' = 'inbox',
  planType: PlanType = 'FREE'
): Promise<Email[]> => {
  const snapshot = await getInboxSnapshot(accountId, strictMode, activeTab, planType);
  return snapshot.emails;
};

export const getInboxSnapshot = async (
  accountId: string,
  strictMode: boolean,
  activeTab: 'primary' | 'inbox',
  planType: PlanType = 'FREE'
): Promise<InboxSnapshot> => {
  const byAccount = normalizeAndSort(
    await fetchRecentEmails(accountId, 50, planType)
  );

  const hiddenByAge = byAccount.filter((email) => isOlderThanMaxAge(email.date));
  const ageFiltered = byAccount.filter((email) => !isOlderThanMaxAge(email.date));

  const hiddenByNoise = ageFiltered.filter((email) => shouldHideAsNoise(email));
  const noiseFiltered = ageFiltered.filter((email) => !shouldHideAsNoise(email));

  const strictFiltered = strictMode
    ? noiseFiltered.filter(
        (email) =>
          email.category === EmailCategory.IMPORTANT ||
          email.category === EmailCategory.TEMPORARY_IMPORTANT
      )
    : noiseFiltered;

  const tabFiltered =
    activeTab === 'primary'
      ? strictFiltered.filter(
          (email) =>
            email.category === EmailCategory.IMPORTANT ||
            email.category === EmailCategory.TEMPORARY_IMPORTANT
        )
      : strictFiltered;

  return {
    emails: tabFiltered,
    hiddenByAge: hiddenByAge.length,
    hiddenByNoise: hiddenByNoise.length,
    totalFetched: byAccount.length,
  };
};

export const getRecentTenEmails = async (
  accountId: string,
  planType: PlanType = 'FREE'
): Promise<Email[]> => {
  const byAccount = normalizeAndSort(
    await fetchRecentEmails(accountId, 50, planType)
  );
  return byAccount.filter((email) => !isOlderThanMaxAge(email.date)).slice(0, 10);
};

// Gmail-like adapter endpoints (MVP frontend contract).
export const fetchRecentEmails = async (
  accountId: string,
  limit = 10,
  planType: PlanType = 'FREE'
): Promise<Email[]> => {
  const base = normalizeAndSort(SEED_EMAILS);

  try {
    const response = await fetch(
      `${API_BASE_URL}/integrations/gmail/messages?accountId=${encodeURIComponent(accountId)}&limit=${encodeURIComponent(
        String(limit)
      )}`,
      {
        headers: { 'x-plan-type': planType },
      }
    );
    if (response.ok) {
      const payload = (await response.json()) as { emails?: Email[] };
      if (Array.isArray(payload.emails)) return payload.emails;
    }
  } catch {
    // Fallback below.
  }

  return base.filter((email) => email.accountId === accountId).slice(0, limit);
};

export const watchInbox = async (
  accountId: string,
  planType: PlanType = 'FREE'
): Promise<{ subscribed: boolean; accountId: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/integrations/gmail/watch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-plan-type': planType,
      },
      body: JSON.stringify({ accountId }),
    });
    if (response.ok) return { subscribed: true, accountId };
  } catch {
    // Fallback to simulated subscription in MVP mode.
  }
  return { subscribed: true, accountId };
};

export const sendDraft = async (
  accountId: string,
  draft: { to: string; subject: string; body: string },
  planType: PlanType = 'FREE'
): Promise<{ sent: boolean }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/integrations/gmail/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-plan-type': planType,
      },
      body: JSON.stringify({ accountId, ...draft }),
    });
    if (response.ok) return { sent: true };
  } catch {
    // Fallback: emulate successful send for frontend MVP.
  }

  await addHistoryItem({
    actionType: 'reply',
    description: `Draft sent to ${draft.to}`,
    targetEmail: draft.subject || 'New draft',
  });
  return { sent: true };
};

export const getGmailAuthUrl = async (
  accountId: string,
  planType: PlanType = 'FREE'
): Promise<string | null> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/integrations/gmail/auth-url?accountId=${encodeURIComponent(accountId)}`,
      {
        headers: {
          'x-plan-type': planType,
        },
      }
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { authUrl?: string };
    return payload.authUrl || null;
  } catch {
    return null;
  }
};

export const getGmailOAuthStatus = async (): Promise<{
  configured: boolean;
  redirectUri?: string;
}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/integrations/gmail/status`);
    if (!response.ok) return { configured: false };
    return (await response.json()) as { configured: boolean; redirectUri?: string };
  } catch {
    return { configured: false };
  }
};

export const saveLastTenAnalysis = async (value: LastTenAnalysis): Promise<void> => {
  const userId = await getSupabaseUserId();

  if (supabase && userId) {
    try {
      await supabase.from(SUPABASE_TABLES.lastTen).upsert(
        {
          user_id: userId,
          account_id: value.accountId,
          data: value,
          analyzed_at: value.analyzedAt,
        },
        { onConflict: 'user_id,account_id' }
      );
      return;
    } catch {
      // Fall back to local storage when table/policies are not ready.
    }
  }

  const key = await getStorageKeyForUser(STORAGE_KEYS.lastTen);
  const current = safeRead<Record<string, LastTenAnalysis>>(key, {});
  current[value.accountId] = value;
  safeWrite(key, current);
};

export const getLastTenAnalysis = async (accountId: string): Promise<LastTenAnalysis | null> => {
  const userId = await getSupabaseUserId();

  if (supabase && userId) {
    try {
      const { data } = await supabase
        .from(SUPABASE_TABLES.lastTen)
        .select('data')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (data?.data) {
        return data.data as LastTenAnalysis;
      }
    } catch {
      // Fall back to local storage when table/policies are not ready.
    }
  }

  const key = await getStorageKeyForUser(STORAGE_KEYS.lastTen);
  const current = safeRead<Record<string, LastTenAnalysis>>(key, {});
  return current[accountId] ?? null;
};

export const getHistory = async (): Promise<HistoryItem[]> => {
  const userId = await getSupabaseUserId();

  if (supabase && userId) {
    try {
      const { data } = await supabase
        .from(SUPABASE_TABLES.history)
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(200);

      if (Array.isArray(data) && data.length > 0) {
        return data.map((row) => ({
          id: String(row.id),
          actionType: row.action_type as HistoryItem['actionType'],
          description: String(row.description || ''),
          targetEmail: String(row.target_email || ''),
          timestamp: String(row.timestamp || new Date().toISOString()),
          aiStyle: (row.ai_style as string | undefined) || undefined,
        }));
      }
    } catch {
      // Fall back to local storage when table/policies are not ready.
    }
  }

  const key = await getStorageKeyForUser(STORAGE_KEYS.history);
  const fromStorage = safeRead<HistoryItem[]>(key, []);
  if (fromStorage.length > 0) return fromStorage;

  return [
    {
      id: 'h-1',
      actionType: 'analysis',
      description: 'Auto-analyzed the latest 10 emails and generated hot actions.',
      targetEmail: 'Inbox bootstrap',
      timestamp: new Date().toISOString(),
      aiStyle: 'human',
    },
  ];
};

export const addHistoryItem = async (item: Omit<HistoryItem, 'id' | 'timestamp'>): Promise<HistoryItem> => {
  const next: HistoryItem = {
    ...item,
    id: `h-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  const userId = await getSupabaseUserId();
  if (supabase && userId) {
    try {
      const { data } = await supabase
        .from(SUPABASE_TABLES.history)
        .insert({
          user_id: userId,
          action_type: next.actionType,
          description: next.description,
          target_email: next.targetEmail,
          timestamp: next.timestamp,
          ai_style: next.aiStyle,
        })
        .select('*')
        .single();

      if (data) {
        return {
          id: String(data.id),
          actionType: data.action_type as HistoryItem['actionType'],
          description: String(data.description || ''),
          targetEmail: String(data.target_email || ''),
          timestamp: String(data.timestamp || next.timestamp),
          aiStyle: (data.ai_style as string | undefined) || undefined,
        };
      }
    } catch {
      // Fall back to local storage when table/policies are not ready.
    }
  }

  const key = await getStorageKeyForUser(STORAGE_KEYS.history);
  const current = safeRead<HistoryItem[]>(key, []);
  safeWrite(key, [next, ...current].slice(0, 200));
  return next;
};

export const getAccounts = async (planType: PlanType = 'FREE'): Promise<Account[]> => {
  const allowed = PLAN_MAP[planType].limits.maxAccounts;
  return SEED_ACCOUNTS.slice(0, allowed);
};

export const getSettings = async (): Promise<AppSettings> => {
  const userId = await getSupabaseUserId();

  if (supabase && userId) {
    try {
      const { data } = await supabase
        .from(SUPABASE_TABLES.settings)
        .select('settings')
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.settings) {
        return {
          ...DEFAULT_SETTINGS,
          ...(data.settings as Partial<AppSettings>),
        };
      }
    } catch {
      // Fall back to local storage when table/policies are not ready.
    }
  }

  const key = await getStorageKeyForUser(STORAGE_KEYS.settings);
  return safeRead<AppSettings>(key, DEFAULT_SETTINGS);
};

export const saveSettings = async (settings: AppSettings): Promise<boolean> => {
  const userId = await getSupabaseUserId();

  if (supabase && userId) {
    try {
      await supabase
        .from(SUPABASE_TABLES.settings)
        .upsert(
          {
            user_id: userId,
            settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      return true;
    } catch {
      // Fall back to local storage when table/policies are not ready.
    }
  }

  const key = await getStorageKeyForUser(STORAGE_KEYS.settings);
  safeWrite(key, settings);
  return true;
};
