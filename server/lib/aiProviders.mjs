import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { config } from './config.mjs';

const CODE_REGEX = /\b\d{4,8}\b/g;
const VERIFY_LINK_REGEX = /https?:\/\/[^\s"']*(verify|confirm|signin|login|auth)[^\s"']*/gi;
const APPEAL_REGEX = /appeal|blocked|ban|suspend|restriction|restricted|апелляц|заблок|нарушен/i;

let gemini = null;
if (config.ai.geminiApiKey) {
  try {
    gemini = new GoogleGenAI({ apiKey: config.ai.geminiApiKey });
  } catch {
    gemini = null;
  }
}

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const uniqActions = (actions) => {
  const seen = new Set();
  return actions.filter((action) => {
    const key = `${action.type}:${action.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const extractCodes = (text) => [...new Set(text.match(CODE_REGEX) || [])].slice(0, 4);
const extractLinks = (text) => [...new Set(text.match(VERIFY_LINK_REGEX) || [])].slice(0, 4);

const heuristicAnalyze = (email) => {
  const text = `${email.subject || ''} ${email.snippet || ''} ${email.body || ''}`;
  const codes = extractCodes(text);
  const links = extractLinks(text);
  const isAppeal = APPEAL_REGEX.test(text);

  const actionButtons = [];
  for (const code of codes) {
    actionButtons.push({
      label: `Copy code ${code}`,
      type: 'copy_code',
      value: code,
      primary: actionButtons.length === 0,
    });
  }

  for (const link of links) {
    actionButtons.push({
      label: actionButtons.length === 0 ? 'Verify now' : 'Open verification link',
      type: 'verify_link',
      value: link,
      primary: actionButtons.length === 0,
    });
  }

  if (isAppeal) {
    actionButtons.push(
      {
        label: 'Draft polite appeal',
        type: 'appeal_reply',
        value: 'polite_appeal',
        primary: actionButtons.length === 0,
      },
      {
        label: 'Ask block reason',
        type: 'appeal_reply',
        value: 'clarify_reason',
        primary: false,
      }
    );
  } else {
    actionButtons.push({
      label: 'Draft reply',
      type: 'draft_reply',
      value: 'standard',
      primary: actionButtons.length === 0,
    });
  }

  if (!actionButtons.some((action) => action.type === 'summarize')) {
    actionButtons.push({
      label: 'Summarize thread',
      type: 'summarize',
      value: 'summary',
      primary: false,
    });
  }

  return {
    summary:
      codes.length || links.length
        ? 'This email requires quick verification action. Key code/link extracted as hot actions.'
        : `${email.snippet || ''}`.slice(0, 220) || 'No summary available.',
    sentiment: codes.length || links.length || isAppeal ? 'urgent' : 'neutral',
    actionButtons: uniqActions(actionButtons),
    replyOptions: isAppeal
      ? ['I do not understand why I was blocked.', 'Please explain the exact reason for the block.']
      : ['Please share more details.', 'Thanks, I will handle this shortly.'],
    extractedCodes: codes,
    extractedLinks: links,
    isAppeal,
  };
};

const analyzePrompt = ({ email, customPrompt }) => [
  'You are Tavelli AI for smart mail triage.',
  'Return strict JSON only with keys:',
  'summary, sentiment, actionButtons, suggestedReply, replyOptions, extractedCodes, extractedLinks, isAppeal.',
  'Rules:',
  '1. Summary should be max 2 sentences.',
  '2. sentiment one of: positive, neutral, negative, urgent.',
  '3. actionButtons can include copy_code, verify_link, draft_reply, appeal_reply, summarize.',
  '4. If user is blocked/suspended, isAppeal=true and include replyOptions.',
  customPrompt ? `Custom instruction: ${customPrompt}` : '',
  `Subject: ${email.subject || ''}`,
  `Snippet: ${email.snippet || ''}`,
  `Body: ${String(email.body || '').replace(/<[^>]+>/g, ' ')}`,
].join('\n');

const geminiAnalyze = async ({ email, customPrompt }) => {
  if (!gemini) return null;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: analyzePrompt({ email, customPrompt }),
      config: { responseMimeType: 'application/json' },
    });

    return response.text ? safeJsonParse(response.text) : null;
  } catch {
    return null;
  }
};

const groqAnalyze = async ({ email, customPrompt }) => {
  if (!config.ai.groqApiKey) return null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Return strict JSON with keys summary, sentiment, actionButtons, suggestedReply, replyOptions, extractedCodes, extractedLinks, isAppeal.',
          },
          {
            role: 'user',
            content: analyzePrompt({ email, customPrompt }),
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content;
    return text ? safeJsonParse(text) : null;
  } catch {
    return null;
  }
};

const mergeResult = (fallback, candidate) => {
  if (!candidate) return fallback;

  const merged = {
    summary: candidate.summary || fallback.summary,
    sentiment: candidate.sentiment || fallback.sentiment,
    suggestedReply: candidate.suggestedReply || fallback.suggestedReply,
    replyOptions: candidate.replyOptions || fallback.replyOptions,
    extractedCodes: candidate.extractedCodes || fallback.extractedCodes,
    extractedLinks: candidate.extractedLinks || fallback.extractedLinks,
    isAppeal:
      typeof candidate.isAppeal === 'boolean' ? candidate.isAppeal : fallback.isAppeal,
    actionButtons: uniqActions(
      (Array.isArray(candidate.actionButtons) && candidate.actionButtons.length
        ? candidate.actionButtons
        : fallback.actionButtons
      ).map((action) => ({
        ...action,
        primary: Boolean(action.primary),
      }))
    ),
  };

  if (!merged.actionButtons.some((action) => action.type === 'summarize')) {
    merged.actionButtons.push({
      label: 'Summarize thread',
      type: 'summarize',
      value: 'summary',
      primary: false,
    });
  }

  return merged;
};

export const analyzeEmailWithProvider = async ({ email, provider = config.ai.defaultProvider, customPrompt = '' }) => {
  const fallback = heuristicAnalyze(email);
  const normalized = String(provider || 'gemini').toLowerCase();

  const candidate =
    normalized === 'groq'
      ? await groqAnalyze({ email, customPrompt })
      : await geminiAnalyze({ email, customPrompt });

  return mergeResult(fallback, candidate);
};

const buildDraftPrompt = ({ email, tone }) => {
  const toneRules = {
    polite_appeal:
      'Write a polite appeal asking for account review and restoration.',
    clarify_reason:
      'Write concise email asking exact reason and evidence for restriction.',
    manual: 'Write concise practical reply.',
    standard: 'Write professional concise reply.',
    firm: 'Write firm but respectful reply.',
    polite: 'Write calm and polite reply.',
  };

  return [
    'Write an email draft in under 160 words.',
    toneRules[tone] || toneRules.standard,
    `Subject: ${email.subject || ''}`,
    `Snippet: ${email.snippet || ''}`,
    `Body: ${String(email.body || '').replace(/<[^>]+>/g, ' ')}`,
  ].join('\n');
};

const geminiText = async (prompt) => {
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

const groqText = async (prompt) => {
  if (!config.ai.groqApiKey) return null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'Write concise practical email drafts.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
};

export const generateDraftWithProvider = async ({ email, tone = 'standard', provider = config.ai.defaultProvider }) => {
  const prompt = buildDraftPrompt({ email, tone });
  const normalized = String(provider || 'gemini').toLowerCase();

  const text =
    normalized === 'groq' ? await groqText(prompt) : await geminiText(prompt);

  if (text) return text;

  if (tone === 'polite_appeal') {
    return 'Hello, I respectfully request a review of my account restriction. I may have misunderstood a rule and am ready to comply with all requirements. Please let me know the exact reason and next steps to restore access. Thank you.';
  }

  if (tone === 'clarify_reason') {
    return 'Hello, I am writing to request clarification regarding my account block. Could you share the exact reason and any relevant details so I can resolve this correctly? Thank you.';
  }

  return 'Hello, thank you for your message. Please share more details so I can resolve this quickly.';
};

export const generateNewEmailWithProvider = async ({ prompt, provider = config.ai.defaultProvider }) => {
  const normalized = String(provider || 'gemini').toLowerCase();
  const jsonPrompt = `Return strict JSON with keys subject and body. User prompt: ${prompt}`;

  const raw = normalized === 'groq' ? await groqText(jsonPrompt) : await geminiText(jsonPrompt);
  const parsed = raw ? safeJsonParse(raw) : null;

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

export const hashAnalysisInput = ({ provider, email, customPrompt, planType }) =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        provider,
        customPrompt,
        planType,
        emailId: email?.id,
        subject: email?.subject,
        snippet: email?.snippet,
        body: email?.body,
      })
    )
    .digest('hex');
