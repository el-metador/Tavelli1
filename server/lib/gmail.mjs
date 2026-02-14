import crypto from 'crypto';
import { google } from 'googleapis';
import { config, missingGmailOAuthConfig } from './config.mjs';
import { getTokenSet, setTokenSet } from './tokenStore.mjs';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

const IMPORTANT_REGEX =
  /booking|бронир|waitlist|verification|verify|код|otp|security|account|аккаунт|subscription|подписк|renew|expire|billing|appeal|blocked|suspend|restricted/i;
const CODE_REGEX = /\b\d{4,8}\b/g;
const VERIFY_LINK_REGEX = /https?:\/\/[^\s"']*(verify|confirm|login|signin)[^\s"']*/gi;

const createOAuthClient = (redirectUri = config.gmail.redirectUri) =>
  new google.auth.OAuth2(config.gmail.clientId, config.gmail.clientSecret, redirectUri);

const signState = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.security.oauthStateSecret)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
};

const verifyState = (token) => {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return null;

  const expected = crypto
    .createHmac('sha256', config.security.oauthStateSecret)
    .update(body)
    .digest('base64url');

  if (expected !== signature) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const parseFromHeader = (fromValue) => {
  const value = String(fromValue || '').trim();
  const match = value.match(/^(.*)<(.+)>$/);
  if (!match) {
    return {
      senderName: value || 'Unknown sender',
      senderEmail: value || 'unknown@example.com',
    };
  }

  return {
    senderName: match[1].trim().replace(/"/g, '') || match[2].trim(),
    senderEmail: match[2].trim(),
  };
};

const decodeBase64 = (value) => {
  if (!value) return '';
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalized, 'base64').toString('utf8');
  } catch {
    return '';
  }
};

const extractBody = (payload) => {
  if (!payload) return '';

  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  const parts = payload.parts || [];
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return decodeBase64(part.body.data);
    }
  }

  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      const text = decodeBase64(part.body.data);
      return text ? `<p>${text.replace(/\n/g, '<br/>')}</p>` : '';
    }
  }

  for (const part of parts) {
    const nested = extractBody(part);
    if (nested) return nested;
  }

  return '';
};

const detectCategory = (subject, snippet, body) => {
  const text = `${subject} ${snippet} ${body}`;
  if (CODE_REGEX.test(text) || VERIFY_LINK_REGEX.test(text)) {
    CODE_REGEX.lastIndex = 0;
    VERIFY_LINK_REGEX.lastIndex = 0;
    return 'TEMPORARY_IMPORTANT';
  }

  CODE_REGEX.lastIndex = 0;
  VERIFY_LINK_REGEX.lastIndex = 0;

  if (IMPORTANT_REGEX.test(text)) return 'IMPORTANT';

  if (/sale|discount|promo|offer|deal/i.test(text)) return 'PROMOTION';
  return 'SOCIAL';
};

export const gmailOAuthStatus = () => ({
  configured: !missingGmailOAuthConfig(),
  scopes: GMAIL_SCOPES,
  redirectUri: config.gmail.redirectUri,
});

export const createAuthUrl = ({ accountId, forceConsent = true, redirectUri }) => {
  if (missingGmailOAuthConfig()) {
    throw new Error('gmail_oauth_not_configured');
  }

  const oauth = createOAuthClient(redirectUri || config.gmail.redirectUri);
  const state = signState({
    accountId,
    createdAt: Date.now(),
  });

  const authUrl = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: forceConsent ? 'consent' : undefined,
    scope: GMAIL_SCOPES,
    state,
  });

  return { authUrl, state };
};

export const handleOAuthCallback = async ({ code, state, redirectUri }) => {
  if (missingGmailOAuthConfig()) {
    throw new Error('gmail_oauth_not_configured');
  }

  const statePayload = verifyState(state);
  if (!statePayload?.accountId) {
    throw new Error('invalid_oauth_state');
  }

  const oauth = createOAuthClient(redirectUri || config.gmail.redirectUri);
  const { tokens } = await oauth.getToken(code);

  await setTokenSet(statePayload.accountId, {
    ...tokens,
    scope: tokens.scope || GMAIL_SCOPES.join(' '),
  });

  return {
    accountId: statePayload.accountId,
    scopes: tokens.scope || GMAIL_SCOPES.join(' '),
  };
};

const getAuthorizedClient = async (accountId) => {
  const tokenSet = await getTokenSet(accountId);
  if (!tokenSet) {
    throw new Error('account_not_connected');
  }

  const oauth = createOAuthClient(config.gmail.redirectUri);
  oauth.setCredentials(tokenSet);

  oauth.on('tokens', async (tokens) => {
    if (!tokens || Object.keys(tokens).length === 0) return;
    await setTokenSet(accountId, {
      ...tokenSet,
      ...tokens,
      refresh_token: tokens.refresh_token || tokenSet.refresh_token,
    });
  });

  return oauth;
};

const toEmailItem = (message, accountId) => {
  const payload = message.payload || {};
  const headers = Object.fromEntries(
    (payload.headers || []).map((header) => [header.name?.toLowerCase(), header.value || ''])
  );

  const subject = headers.subject || '(No subject)';
  const snippet = message.snippet || '';
  const body = extractBody(payload) || `<p>${snippet}</p>`;
  const { senderName, senderEmail } = parseFromHeader(headers.from);

  const dateHeader = headers.date;
  const date =
    (dateHeader && !Number.isNaN(new Date(dateHeader).getTime())
      ? new Date(dateHeader).toISOString()
      : message.internalDate
      ? new Date(Number.parseInt(message.internalDate, 10)).toISOString()
      : new Date().toISOString());

  const unread = Boolean(message.labelIds?.includes('UNREAD'));

  return {
    id: message.id,
    accountId,
    senderName,
    senderEmail,
    subject,
    snippet,
    body,
    date,
    isRead: !unread,
    category: detectCategory(subject, snippet, body),
  };
};

export const fetchRecentEmails = async ({ accountId, limit = 10, query = 'newer_than:7d' }) => {
  const auth = await getAuthorizedClient(accountId);
  const gmail = google.gmail({ version: 'v1', auth });

  const list = await gmail.users.messages.list({
    userId: 'me',
    maxResults: limit,
    q: query,
  });

  const messages = list.data.messages || [];
  if (messages.length === 0) return [];

  const fullMessages = await Promise.all(
    messages.map((item) =>
      gmail.users.messages.get({
        userId: 'me',
        id: item.id,
        format: 'full',
      })
    )
  );

  return fullMessages
    .map((item) => item.data)
    .filter(Boolean)
    .map((message) => toEmailItem(message, accountId));
};

export const sendEmail = async ({ accountId, to, subject, bodyHtml }) => {
  const auth = await getAuthorizedClient(accountId);
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    bodyHtml,
  ].join('\r\n');

  const encoded = Buffer.from(raw).toString('base64url');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encoded,
    },
  });

  return {
    id: result.data.id,
    threadId: result.data.threadId,
  };
};

export const watchInbox = async ({ accountId }) => {
  if (!config.gmail.pubsubTopic) {
    throw new Error('gmail_pubsub_topic_not_configured');
  }

  const auth = await getAuthorizedClient(accountId);
  const gmail = google.gmail({ version: 'v1', auth });

  const result = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: config.gmail.pubsubTopic,
      labelFilterAction: 'include',
      labelIds: ['INBOX'],
    },
  });

  return {
    historyId: result.data.historyId,
    expiration: result.data.expiration,
  };
};
