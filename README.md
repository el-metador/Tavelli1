<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Tavelli MVP - Smart Mail

MVP of Tavelli smart inbox with Supabase backend auth and Google Sign-In.

## Implemented in this version

- Smart inbox with strict AI noise suppression
- System-level hide of emails older than 7 days
- Auto-analysis of latest 10 emails on inbox open
- Hot actions: `copy_code`, `verify_link`, `draft_reply`, `appeal_reply`, `summarize`
- SaaS limits:
  - `PRO` - `$4.50/mo`, up to 3 accounts
  - `ENTERPRISE` - `$10.00/mo`, up to 10 accounts + auto-signature/date/logo toggles
- Backend API:
  - Gmail OAuth + recent messages + send + watch
  - AI endpoints for Gemini/Groq
  - Server-side cache (Redis if configured, otherwise in-memory)
  - API-level rate limits by plan (`FREE/PRO/ENTERPRISE`)
- Supabase auth:
  - Google OAuth login in frontend
  - Session persistence via Supabase Auth
  - Supabase-backed user settings/history/last-ten analysis (with local fallback)
  - Backend auth routes at `/api/auth/supabase/*`

## Prerequisites

- Node.js `20+`
- Supabase project (for Google login)
- Gmail OAuth credentials (for Gmail integration)

## Run locally

1. Install dependencies

```bash
npm install
```

2. Configure `.env.local`

```env
# AI
GEMINI_API_KEY=
GROQ_API_KEY=

# Backend
API_PORT=8787
VITE_API_URL=http://localhost:8787/api
REACT_APP_API_URL=http://localhost:8787/api
ALLOWED_ORIGINS=http://localhost:3000
REDIS_URL=

# Gmail OAuth
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://localhost:8787/api/integrations/gmail/oauth/callback
GMAIL_PUBSUB_TOPIC=
OAUTH_STATE_SECRET=

# Supabase frontend auth
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=

# Supabase backend (optional but recommended)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

3. Start frontend + backend together

```bash
npm run dev:full
```

## Supabase + Google auth setup

1. In Supabase dashboard, enable provider:
   - `Authentication -> Providers -> Google -> Enable`
2. In Google Cloud Console, configure OAuth consent and credentials.
3. Add these redirect URLs:
   - Supabase callback: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Local frontend URL (for app return): `http://localhost:3000`
4. Fill Supabase env keys in `.env.local`.
5. Open Supabase SQL editor and run:

```sql
-- copy and execute
-- file: supabase/mvp_schema.sql
```

This creates:
- `profiles`
- `user_settings`
- `ai_history`
- `last_ten_analysis`
- row-level security policies for per-user access

## Supabase backend routes

- `GET /api/auth/supabase/status` - config status
- `GET /api/auth/supabase/me` - returns authenticated user (requires Bearer token)
- `GET /api/auth/supabase/profile` - profile from DB/metadata
- `PUT /api/auth/supabase/profile` - upsert profile (requires service role key)

## Gmail OAuth flow (MVP)

1. Request auth URL:
   - `GET /api/integrations/gmail/auth-url?accountId=acc-main`
2. Open returned `authUrl` and approve scopes.
3. Callback stores tokens in `server/state/gmail-tokens.json`.
4. Fetch messages:
   - `GET /api/integrations/gmail/messages?accountId=acc-main&limit=10`

## Notes

- If Supabase tables/RLS are not ready, frontend persistence falls back to localStorage.
- If Redis is not configured, cache and counters use in-memory fallback.
- If backend AI is unavailable, frontend falls back to local extraction heuristics.
