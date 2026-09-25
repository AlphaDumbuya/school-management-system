import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading .env from multiple locations to support running from root or backend directory
const envPath1 = path.resolve(__dirname, '../.env');
const envPath2 = path.resolve(__dirname, '../../.env');
const envPath3 = path.resolve(__dirname, '../../../.env');
const envPath4 = path.resolve(process.cwd(), '.env');
const envPath5 = path.resolve(process.cwd(), '../.env');

dotenv.config({ path: envPath1 });
dotenv.config({ path: envPath2 });
dotenv.config({ path: envPath3 });
dotenv.config({ path: envPath4 });
dotenv.config({ path: envPath5 });

// ─────────────────────────────────────────────────────────────────────────────
// Boot-time environment validation.
//
// The single highest-severity risk in the old setup was silent secret
// fallbacks (e.g. `process.env.JWT_SECRET || 'your-secret-key-…'`). If the env
// var was ever unset in production the app would happily sign tokens with a
// public, repo-visible string — trivially forgeable admin tokens.
//
// We now validate the critical secrets at import time. In PRODUCTION a missing
// or obviously-insecure secret is a HARD FAILURE (the process refuses to boot —
// a crashed deploy is infinitely safer than one signing tokens with a known
// key). In development/test we only WARN so local onboarding isn't blocked.
// ─────────────────────────────────────────────────────────────────────────────

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

// Known insecure placeholder values that must never reach production.
const INSECURE_DEFAULTS = new Set([
  'your-secret-key-change-in-production',
  'your-refresh-secret-key-change-in-production',
  'change-me',
  'changeme',
  'secret',
]);

const secret = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .min(32, `${label} must be at least 32 characters`)
    .refine((v) => !INSECURE_DEFAULTS.has(v.trim().toLowerCase()), {
      message: `${label} is set to a known insecure placeholder — set a real secret`,
    });

// Production schema — the invariants that MUST hold before we accept traffic.
// Non-secret operational vars keep sensible optionality; secrets are strict.
const ProdEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  JWT_SECRET: secret('JWT_SECRET'),
  REFRESH_TOKEN_SECRET: secret('REFRESH_TOKEN_SECRET'),
  // Either the pooled URL or discrete DB_* credentials must be present.
  DATABASE_URL: z.string().min(1).optional(),
  DB_HOST: z.string().min(1).optional(),
}).superRefine((val, ctx) => {
  if (!val.DATABASE_URL && !val.DB_HOST) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either DATABASE_URL or DB_HOST (+ DB_* credentials) must be set',
      path: ['DATABASE_URL'],
    });
  }
});

export function validateEnv(): void {
  const result = ProdEnvSchema.safeParse(process.env);

  if (result.success) {
    return;
  }

  const issues = result.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');

  if (IS_PROD) {
    // Fail hard — do NOT boot with insecure/missing secrets in production.
    // eslint-disable-next-line no-console
    console.error(`\n❌ Invalid environment configuration — refusing to start:\n${issues}\n`);
    process.exit(1);
  } else {
    // Local/test: warn loudly but continue so onboarding isn't blocked.
    // eslint-disable-next-line no-console
    console.warn(
      `\n⚠️  Environment configuration warnings (${NODE_ENV}) — these WOULD block a production boot:\n${issues}\n`
    );
  }
}

// Run validation as a side-effect of importing this module (index.ts imports it
// first, before any secret is read).
validateEnv();

console.log('🌍 Environment loader initialized. DATABASE_URL present:', !!process.env.DATABASE_URL);
