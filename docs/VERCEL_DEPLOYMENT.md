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

### 3. Run Database Migrations

After the first deploy, run migrations against your production database:

```bash
# From the backend directory, with DATABASE_URL pointing to production:
DATABASE_URL="your-neon-url" npm run db:migrate -w backend
```

Or use the Vercel CLI to run it in the Vercel environment:

```bash
vercel env pull .env.production.local
cd backend && npx knex migrate:latest
```

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
