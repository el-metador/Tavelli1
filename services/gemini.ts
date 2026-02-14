import { GoogleGenAI } from '@google/genai';
import {
  AIActionButton,
  AIAnalysisResult,
  AIProvider,
  Email,
  LastTenAnalysis,
  PlanType,
} from '../types';

const API_BASE_URL =
  ((globalThis as any).process?.env?.REACT_APP_API_URL as string | undefined) ||
  '/api';

const GEMINI_API_KEY =
  ((globalThis as any).process?.env?.API_KEY as string | undefined) ||
  ((globalThis as any).process?.env?.GEMINI_API_KEY as string | undefined) ||
  '';

const GROQ_API_KEY =
  ((globalThis as any).process?.env?.GROQ_API_KEY as string | undefined) ||
  '';

let gemini: GoogleGenAI | null = null;
if (GEMINI_API_KEY) {
  try {
    gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  } catch {
    gemini = null;
  }
}

const CODE_REGEX = /\b\d{4,8}\b/g;
const VERIFY_LINK_REGEX = /https?:\/\/[^\s"']*(verify|confirm|signin|login|auth)[^\s"']*/gi;
const APPEAL_REGEX = /appeal|blocked|ban|suspend|restriction|restricted|апелляц|заблок|нарушен/i;

const uniqActions = (actions: AIActionButton[]): AIActionButton[] => {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.type}:${action.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const safeJsonParse = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const extractCodes = (text: string): string[] => {
  const matches = text.match(CODE_REGEX) || [];
  return [...new Set(matches)].slice(0, 3);
};

const extractVerifyLinks = (text: string): string[] => {
  const matches = text.match(VERIFY_LINK_REGEX) || [];
  return [...new Set(matches)].slice(0, 3);
};

const getFallbackSummary = (email: Email): string => {
  const content = `${email.snippet} ${email.body}`
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const short = content.slice(0, 220);
  if (short.length === 0) return 'No meaningful content was detected.';
  if (content.length <= 220) return short;
  return `${short}...`;
};

const heuristicAnalysis = (email: Email): AIAnalysisResult => {
  const fullText = `${email.subject} ${email.snippet} ${email.body}`;
  const extractedCodes = extractCodes(fullText);
  const extractedLinks = extractVerifyLinks(fullText);
  const isAppeal = APPEAL_REGEX.test(fullText);

  const actions: AIActionButton[] = [];
  extractedCodes.forEach((code, index) => {
    actions.push({
      label: index === 0 ? `Copy code ${code}` : `Copy ${code}`,
      type: 'copy_code',
      value: code,
      primary: index === 0,
    });
  });

  extractedLinks.forEach((link, index) => {
    actions.push({
      label: index === 0 ? 'Verify now' : 'Open verification link',
      type: 'verify_link',
      value: link,
      primary: extractedCodes.length === 0 && index === 0,
    });
  });

  if (isAppeal) {
    actions.push(
      {
        label: 'Draft polite appeal',
        type: 'appeal_reply',
        value: 'polite_appeal',
        primary: extractedCodes.length === 0 && extractedLinks.length === 0,
      },
      {
        label: 'Ask block reason',
        type: 'appeal_reply',
        value: 'clarify_reason',
        primary: false,
      }
    );
  } else {
    actions.push({
      label: 'Draft reply',
      type: 'draft_reply',
      value: 'standard',
      primary: actions.length === 0,
    });
  }

  actions.push({
    label: 'Summarize thread',
    type: 'summarize',
    value: 'summary',
    primary: false,
  });

  const sentiment: AIAnalysisResult['sentiment'] =
    isAppeal || extractedCodes.length > 0 || extractedLinks.length > 0 ? 'urgent' : 'neutral';

  const summary =
    extractedCodes.length > 0 || extractedLinks.length > 0
      ? 'This email requires quick verification action. Tavelli extracted the key code and links as hot actions.'
      : getFallbackSummary(email);

  return {
    summary,
    sentiment,
    actionButtons: uniqActions(actions),
    replyOptions: isAppeal
      ? ['I do not understand why I was blocked.', 'Please explain the exact reason for the block.']
      : ['Please share more details.', 'Thanks, I will handle this today.'],
    extractedCodes,
    extractedLinks,
    isAppeal,
    suggestedReply: undefined,
  };
};

interface AIModelResponse {
  summary: string;
  sentiment: AIAnalysisResult['sentiment'];
  actionButtons: AIActionButton[];
  suggestedReply?: string;
  replyOptions?: string[];
  extractedCodes?: string[];
  extractedLinks?: string[];
  isAppeal?: boolean;
}

const mergeWithFallback = (
  fallback: AIAnalysisResult,
  modelResult: AIModelResponse | null
): AIAnalysisResult => {
  if (!modelResult) return fallback;

  const merged: AIAnalysisResult = {
    summary: modelResult.summary || fallback.summary,
    sentiment: modelResult.sentiment || fallback.sentiment,
    suggestedReply: modelResult.suggestedReply || fallback.suggestedReply,
    replyOptions: modelResult.replyOptions || fallback.replyOptions,
    extractedCodes: modelResult.extractedCodes || fallback.extractedCodes,
    extractedLinks: modelResult.extractedLinks || fallback.extractedLinks,
    isAppeal:
      typeof modelResult.isAppeal === 'boolean'
        ? modelResult.isAppeal
        : fallback.isAppeal,
    actionButtons: uniqActions(
      (modelResult.actionButtons && modelResult.actionButtons.length > 0
        ? modelResult.actionButtons
        : fallback.actionButtons
      ).map((action) => ({
        ...action,
        primary: Boolean(action.primary),
      }))
    ),
  };

  if (!merged.actionButtons.some((btn) => btn.type === 'summarize')) {
    merged.actionButtons.push({
      label: 'Summarize thread',
      type: 'summarize',
      value: 'summary',
      primary: false,
    });
  }

  return merged;
};

const postJson = async <T>(
  path: string,
  body: Record<string, unknown>,
  planType: PlanType
): Promise<T | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-plan-type': planType,
      },
      body: JSON.stringify({ ...body, planType }),
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const buildAnalyzePrompt = (email: Email, customPrompt?: string): string => {
  const extra = customPrompt ? `User custom instruction: ${customPrompt}\n` : '';
  return [
    'You are Tavelli AI for a Gmail-like mailbox.',
    'Analyze this email and return ONLY JSON.',
    'Requirements:',
    '1) 1-2 sentence summary.',
    '2) Sentiment: positive|neutral|negative|urgent.',
    '3) Extract verification codes (4-8 digits) and verification links.',
    '4) If this email is a block/suspension notice, set isAppeal=true and provide two reply options.',
    '5) Create action buttons for copy_code, verify_link, appeal_reply, draft_reply, summarize.',
    'JSON format:',
    '{"summary":"string","sentiment":"urgent","suggestedReply":"string","replyOptions":["string"],"extractedCodes":["123456"],"extractedLinks":["https://..."],"isAppeal":false,"actionButtons":[{"label":"Copy code 123456","type":"copy_code","value":"123456","primary":true}]}',
    extra,
    `Subject: ${email.subject}`,
    `Snippet: ${email.snippet}`,
    `Body: ${email.body.replace(/<[^>]+>/g, ' ')}`,
  ].join('\n');
};

const callGeminiAnalyze = async (
  email: Email,
  customPrompt?: string
): Promise<AIModelResponse | null> => {
  if (!gemini) return null;
  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: buildAnalyzePrompt(email, customPrompt),
      config: { responseMimeType: 'application/json' },
    });

    if (!response.text) return null;
    return safeJsonParse<AIModelResponse>(response.text);
  } catch {
    return null;
  }
};

const callGroqAnalyze = async (
  email: Email,
  customPrompt?: string
): Promise<AIModelResponse | null> => {
  if (!GROQ_API_KEY) return null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are Tavelli AI. Return strict JSON only with fields summary, sentiment, actionButtons, suggestedReply, replyOptions, extractedCodes, extractedLinks, isAppeal.',
          },
          {
            role: 'user',
            content: buildAnalyzePrompt(email, customPrompt),
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    return safeJsonParse<AIModelResponse>(content);
  } catch {
    return null;
  }
};

export interface AnalyzeOptions {
  provider?: AIProvider;
  customPrompt?: string;
  planType?: PlanType;
  accountId?: string;
}

export const analyzeEmail = async (
  email: Email,
  options: AnalyzeOptions = {}
): Promise<AIAnalysisResult> => {
  const fallback = heuristicAnalysis(email);
  const provider = options.provider ?? 'gemini';
  const planType = options.planType ?? 'FREE';

  const backend = await postJson<{ cached: boolean; result: AIModelResponse }>(
    '/ai/analyze-email',
    {
      email,
      provider,
      customPrompt: options.customPrompt || '',
      accountId: options.accountId || email.accountId || 'default',
    },
    planType
  );

  if (backend?.result) {
    return mergeWithFallback(fallback, backend.result);
  }

  if (provider === 'groq') {
    const result = await callGroqAnalyze(email, options.customPrompt);
    return mergeWithFallback(fallback, result);
  }

  const result = await callGeminiAnalyze(email, options.customPrompt);
  return mergeWithFallback(fallback, result);
};

const buildReplyPrompt = (email: Email, tone: string): string => {
  const cleanedBody = email.body.replace(/<[^>]+>/g, ' ');

  const toneMap: Record<string, string> = {
    polite_appeal:
      'Write a polite appeal. Ask for reconsideration and show willingness to cooperate.',
    clarify_reason:
      'Write a concise reply asking for exact reason and evidence behind the block.',
    polite: 'Write in polite and calm tone.',
    firm: 'Write in firm but respectful tone.',
    standard: 'Write a clear professional reply.',
    manual: 'Write a concise and helpful reply draft.',
  };

  return [
    'Write email reply draft. Keep under 160 words.',
    toneMap[tone] || toneMap.standard,
    `Subject: ${email.subject}`,
    `Snippet: ${email.snippet}`,
    `Body: ${cleanedBody}`,
  ].join('\n');
};

const callGeminiText = async (prompt: string): Promise<string | null> => {
  if (!gemini) return null;
  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: prompt,
    });
    return response.text || null;
  } catch {
    return null;
  }
};

const callGroqText = async (prompt: string): Promise<string | null> => {
  if (!GROQ_API_KEY) return null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'You are Tavelli AI. Write concise, practical email drafts.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return payload.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
};

export const generateDraft = async (
  email: Email,
  tone: string,
  provider: AIProvider = 'gemini',
  planType: PlanType = 'FREE'
): Promise<string> => {
  const backend = await postJson<{ text: string }>(
    '/ai/generate-draft',
    { email, tone, provider, accountId: email.accountId || 'default' },
    planType
  );
  if (backend?.text) return backend.text;

  const prompt = buildReplyPrompt(email, tone);
  const result =
    provider === 'groq' ? await callGroqText(prompt) : await callGeminiText(prompt);
  if (result) return result;

  if (tone === 'polite_appeal') {
    return 'Hello, I respectfully request a review of my account restriction. I may have misunderstood a rule and I am ready to follow all requirements. Please let me know the reason and what steps are needed to restore access. Thank you.';
  }
  if (tone === 'clarify_reason') {
    return 'Hello, I am writing to request clarification about the account block. Could you share the exact reason and relevant details so I can resolve it correctly? Thank you.';
  }

  return 'Hello, thanks for your message. Could you please share additional details so I can respond accurately?';
};

export const generateNewEmailDraft = async (
  prompt: string,
  provider: AIProvider = 'gemini',
  planType: PlanType = 'FREE',
  accountId = 'default'
): Promise<{ subject: string; body: string }> => {
  const backend = await postJson<{ subject: string; body: string }>(
    '/ai/new-email-draft',
    { prompt, provider, accountId },
    planType
  );

  if (backend?.subject && backend?.body) {
    return {
      subject: backend.subject,
      body: backend.body,
    };
  }

  const jsonPrompt = `Return ONLY JSON with keys subject and body. User request: ${prompt}`;
  const raw =
    provider === 'groq' ? await callGroqText(jsonPrompt) : await callGeminiText(jsonPrompt);
  const parsed = raw ? safeJsonParse<{ subject?: string; body?: string }>(raw) : null;

  if (parsed?.subject && parsed?.body) {
    return {
      subject: parsed.subject,
      body: parsed.body,
    };
  }

  return {
    subject: 'Draft email',
    body: `Hello,\n\n${prompt}\n\nBest regards,`,
  };
};

export const analyzeLatestTenEmails = async (
  emails: Email[],
  accountId: string,
  provider: AIProvider = 'gemini',
  planType: PlanType = 'FREE'
): Promise<LastTenAnalysis> => {
  const sliced = emails.slice(0, 10);

  const analyses = await Promise.all(
    sliced.map(async (email) => {
      const result = await analyzeEmail(email, {
        provider,
        planType,
        accountId: email.accountId || accountId,
      });
      return { email, result };
    })
  );

  const hotActions = uniqActions(
    analyses.flatMap(({ result }) => result.actionButtons).slice(0, 12)
  );

  const importantEmailIds = analyses
    .filter(
      ({ result }) =>
        result.sentiment === 'urgent' || (result.extractedCodes?.length || 0) > 0
    )
    .map(({ email }) => email.id);

  const hiddenEmailIds = analyses
    .filter(
      ({ result }) =>
        (result.sentiment === 'neutral' || result.sentiment === 'positive') &&
        result.actionButtons.length <= 1
    )
    .map(({ email }) => email.id);

  return {
    accountId,
    analyzedAt: new Date().toISOString(),
    analyzedEmailIds: sliced.map((item) => item.id),
    importantEmailIds,
    hiddenEmailIds,
    hotActions,
  };
};
