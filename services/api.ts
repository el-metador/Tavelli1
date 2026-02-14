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
import { getSupabaseUser, getSupabaseUserId, supabase } from './supabase';

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

const normalizeAccountPart = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

const getPrimaryAccountFromAuth = async (): Promise<Account | null> => {
  const user = await getSupabaseUser();
  if (!user?.email) return null;

  const local = user.email.split('@')[0] || user.id;
  const idPart = normalizeAccountPart(local) || user.id.slice(0, 8);
  const displayName = user.fullName?.trim() || local;

  return {
    id: `acc-${idPart}`,
    email: user.email,
    name: displayName,
    avatar: user.avatarUrl || '',
    provider: 'gmail',
    isActive: true,
  };
};

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
    // Return empty state when backend is unavailable.
  }

  return [];
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
    // Return clean failure when backend is unavailable.
  }
  return { subscribed: false, accountId };
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
    // Return clean failure when backend is unavailable.
  }
  return { sent: false };
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

  return [];
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
  if (allowed <= 0) return [];

  const primary = await getPrimaryAccountFromAuth();
  if (!primary) return [];

  return [primary];
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
