# Vercel Deployment Guide

## Architecture

On Vercel, both the frontend and backend are deployed together:

- **Frontend** → Static React build (`frontend/dist`) served by Vercel's CDN
- **Backend** → Express API compiled to `backend/dist/index.js` and wrapped in a Vercel Serverless Function at `api/index.ts`
- All `/api/*` requests are routed to the serverless function; everything else serves the React SPA

## Prerequisites

1. A Vercel account at [vercel.com](https://vercel.com)
2. A PostgreSQL database (recommended: [Neon](https://neon.tech) — free tier available, serverless-friendly)
3. The [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`

## Deploy Steps

### 1. Import the project

Go to [vercel.com/new](https://vercel.com/new) → Import your Git repo.

Vercel will detect the `vercel.json` at the root and use its config automatically.

### 2. Set Environment Variables

In the Vercel dashboard → Project Settings → Environment Variables, add:

#### Required

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | JWT signing secret (≥32 chars) | `openssl rand -base64 32` |
| `REFRESH_TOKEN_SECRET` | Refresh token secret (≥32 chars) | `openssl rand -base64 32` |
| `NODE_ENV` | Must be `production` | `production` |

#### Recommended

| Variable | Description |
|---|---|
| `BREVO_API_KEY` | Email notifications via Brevo |
| `BREVO_SENDER_EMAIL` | Sender address for emails |
| `FRONTEND_URL` | Your Vercel deployment URL (e.g. `https://your-app.vercel.app`) — used by CORS |

#### Optional

| Variable | Description |
|---|---|
| `STORAGE_PROVIDER` | `local` (not recommended on serverless) or `s3` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET` / `AWS_REGION` | If using S3 for file storage |
| `REDIS_URL` | Redis for caching/queues (e.g. Upstash) |
| `LOG_LEVEL` | `info` or `error` for production |

> **Note:** Do NOT set `VITE_API_URL` in Vercel — leaving it empty makes the frontend use relative URLs so API calls go to the same domain. This is exactly what you want on Vercel.

### 3. Database Migrations (run AUTOMATICALLY on every deploy)

Migrations now run as part of the Vercel **build**. The `buildCommand` in
`vercel.json` is:

```
(cd backend && tsup && knex migrate:latest --knexfile knexfile.js) && (cd frontend && vite build)
```

So `knex migrate:latest` executes against the production database on every
deploy, right after the backend compiles and before the frontend builds. A
failing migration fails the whole deploy — this is intentional, so you never
ship code whose schema hasn't been applied.

> **CRITICAL:** because migrations run at BUILD time, `DATABASE_URL` MUST be
> exposed to the **Build** environment in Vercel — not just Runtime. In Vercel →
> Project Settings → Environment Variables, ensure `DATABASE_URL` (and
> `NODE_ENV=production`) are enabled for the **Production** (and Preview)
> environments, which Vercel makes available to the build step. If
> `DATABASE_URL` is missing at build time, the migrate step fails and the deploy
> aborts. (This exact gap — migrations never running — is what previously left
> `refresh_tokens.token_hash` missing in prod and broke login with a 500.)

If you ever need to run migrations manually against production (e.g. to
back-fill without a full redeploy):

```bash
vercel env pull .env.production.local
cd backend && npx tsup && NODE_ENV=production npx knex migrate:latest --knexfile knexfile.js
```

> Note: the production knex config reads compiled migrations from
> `backend/dist/database/migrations/*.js`, so you must `tsup` (build) first. The
> `tsup.config.ts` emits each migration/seed as its own file for exactly this
> reason.

### 4. Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

## Important Limitations on Serverless

| Feature | Status | Notes |
|---|---|---|
| REST API | ✅ Works | All Express routes work |
| Database (PostgreSQL) | ✅ Works | Use Neon for serverless-compatible Postgres |
| File uploads (local) | ⚠️ Temporary | Serverless has ephemeral storage — use S3 |
| Socket.io (WebSockets) | ⚠️ Limited | Vercel supports WebSockets on Pro plan only; polling transport works on free |
| Background jobs (node-cron) | ❌ Won't run | Serverless functions have no persistent process — use Vercel Cron Jobs instead |
| Redis / BullMQ | ⚠️ Optional | Use Upstash Redis for serverless-compatible queues |

## Vercel Cron Jobs (replaces node-cron)

If you need scheduled jobs, add them to `vercel.json`:

```json
"crons": [
  {
    "path": "/api/cron/daily-tasks",
    "schedule": "0 2 * * *"
  }
]
```

Then create `api/cron/daily-tasks.ts` as a Vercel function.

## Pre-Launch Production Checklist

Confirm these before going live:

- [ ] **`DATABASE_URL` available at BUILD time** (see Step 3) — required for the
      auto-migration to run. Missing this is the #1 cause of a broken deploy.
- [ ] **`JWT_SECRET` / `REFRESH_TOKEN_SECRET`** set to strong, unique values
      (≥32 chars) — NOT the dev defaults.
- [ ] **`REDIS_URL`** set to a managed Redis (Upstash TCP/TLS string, e.g.
      `rediss://default:<pw>@<host>.upstash.io:6379` — the double-`s` TLS URL,
      NOT the REST URL/token). This backs the distributed login/OTP rate limiter
      so brute-force protection holds across serverless instances. The app now
      fails OPEN if Redis is unreachable (login is never blocked by a Redis
      outage), so this is recommended, not strictly required — but without it
      rate limits are per-instance and weak.
- [ ] **CSP is still Report-Only.** `vercel.json` sends
      `Content-Security-Policy-Report-Only`. Validate the policy against all
      flows (see `docs/CONTENT_SECURITY_POLICY.md`), then rename the header to
      `Content-Security-Policy` to actually ENFORCE it. Tighten `connect-src` to
      your real API origin at the same time.
- [ ] **`FRONTEND_URL`** set to the production origin (used by CORS + email links).
- [ ] **Do NOT set `VITE_API_URL`** in Vercel (leave empty → same-origin API).
- [ ] **Scheduled jobs** (`node-cron`) do NOT run on serverless. If you rely on
      the subscription-expiry sweep, SMS delivery job, or event jobs, port them
      to Vercel Cron Jobs (see below) or run a small always-on worker elsewhere.
- [ ] **File storage**: set `STORAGE_PROVIDER=s3` (+ AWS keys) — serverless disk
      is ephemeral, so `local` storage loses uploads between invocations.

## Custom Domain

In Vercel dashboard → Domains → Add your domain. SSL is handled automatically.

## Troubleshooting

**Build fails with TypeScript errors:**
Check that `npm run build -w backend` passes locally first.

**API returns 500:**
Check the Vercel function logs in the dashboard → Deployments → Functions tab.

**CORS errors:**
Make sure `FRONTEND_URL` is set to your Vercel URL in environment variables.

**Database connection errors:**
Neon requires `?sslmode=require` in the connection string. Make sure your `DATABASE_URL` includes it.
