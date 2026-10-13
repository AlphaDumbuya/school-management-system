# Single-School White-Label Deployment Plan

Goal: ship a custom, fully rebranded copy of this app to ONE school (no WiSkul name anywhere), while keeping the WiSkul multi-tenant platform untouched.

Approach: **keep the multi-tenant code, run it with exactly one tenant.** Do not rip out `tenant_id`. It is in 274+ backend files, 51+ tables, the RLS policies and the auth tokens. Removing it is weeks of risky work for no real gain. A column that always holds the same value costs nothing.

Estimated effort:
- Web app only: 1 to 2 days.
- Plus Android app and final QA of emails, PDFs, report cards and ID cards: about 1 more day.

---

## 0. Safety rules (read first)

- The `DATABASE_URL` in this repo's `.env` is the REAL shared Neon database with every school's data. **Never reuse it in the copy.**
- The copy gets its own Neon project, its own Vercel project and its own secrets (`JWT_SECRET`, `ENCRYPTION_KEY`, Brevo keys, payment keys).
- Do not run the test suite, seeds, rollbacks or reset scripts against any remote database (see `.kiro/steering` database-safety rule). Use `TEST_DATABASE_URL` pointing to a local or throw-away DB.
- Verify builds with `bash scripts/vercel-build.sh` (`VERCEL_ENV=preview` skips migrations), `vite build --mode app` in `frontend`, and `tsc --noEmit`.

## 1. Collect the client details (before starting)

| Item | Value |
|---|---|
| School display name | |
| Short name / abbreviation | |
| Domain (e.g. portal.schoolname.edu) | |
| Support email / sender email | |
| Sender domain (Brevo SPF/DKIM) | |
| Logo files (PNG, square, transparent; SVG if available) | |
| Brand colors (primary, accent) | |
| Address, phone, website (for PDFs / report cards / ID cards) | |
| Needs Android app? (yes/no) | |
| Payment provider (Monime etc.) and credentials | |
| Plan features the school gets (all unlocked?) | |

## 2. Create the copy

1. Make a new repo from this one (fresh git history is recommended; do not push to the WiSkul remote).
   - Copy the folder without `.git`, `node_modules`, `dist`, `logs`, `.env`, `.vercel`.
   - `git init`, then commit.
2. New Neon project, so a new `DATABASE_URL`. Run only `migrate:latest` on it.
3. New Vercel project (`vercel link` in the copy; make sure the old `.vercel/project.json` is not carried over).
4. New `.env` from `.env.example`, filled with the client's values and NEW secrets.

## 3. Central brand config (the key step)

The school name is already dynamic (`schools` table / `user.schoolName`), but the **platform brand is hardcoded**. Create one source of truth on each side and replace the literals.

Backend, e.g. `backend/src/config/brand.ts`, reading env vars:
- `BRAND_NAME`, `BRAND_SHORT_NAME`, `BRAND_DOMAIN`, `BRAND_URL`
- `SUPPORT_EMAIL`, `INFO_EMAIL`, `SALES_EMAIL`, `NOREPLY_EMAIL`, `BREVO_SENDER_NAME`
- logo path or URL

Frontend, e.g. `frontend/src/config/brand.ts`, reading `VITE_BRAND_*`:
- name, short name, logo path, support email, URL, storage-key prefix

Existing fallbacks to start from: `backend/src/services/email/emailBranding.ts` (`platformBranding()`), which already has one platform object with a `BREVO_SENDER_NAME` env override.

## 4. Replace hardcoded "WiSkul" (grep inventory)

Counts at the time of writing (case-insensitive `wiskul`):

| Area | Files | Hits |
|---|---|---|
| `backend/src` | 34 | ~157 |
| `frontend/src` | 71 | ~290 |
| `frontend/index.html` | 1 | 43 |
| `frontend/public` (`manifest.json`, `assetlinks.json`, logo) | 3 | 13 |
| `docs` | 8 | 26 |
| `.github/workflows` | 2 | 17 |
| Android (`frontend/android/...`) | many | n/a |

Known hot spots:

Backend
- `services/emailService.ts` (sender names, reply-to defaults, `*@wiskulsl.com`)
- `services/email/emailBranding.ts`, `emailLayout.ts` (footer "Sent with ...", link to wiskulsl.com), `receiptPdf.ts`
- `assets/platformLogo.ts` (logo embedded for emails)
- `routes/brandingRoutes.ts` (platform logo endpoint)
- `services/backupService.ts` (workbook title/creator), `routes/platformRoutes.ts` (backup filename)
- `routes/authRoutes.ts` (welcome/verification messages), `middleware/demoReadOnly.ts`
- `services/passkeyService.ts` (`WEBAUTHN_RP_ID` default `www.wiskulsl.com`)
- `routes/appStatsRoutes.ts` (APK download `wiskul.apk`, `User-Agent`)
- Migrations 152 and 171 only mention WiSkul in comments and a default dev key; leave migrations alone.

Frontend
- `components/layout/Header.tsx`, `Sidebar.tsx` (logo + fallback name), `MainLayout.tsx`, `ImpersonationBanner.tsx`
- `components/offline/*`, `components/app/NativeUpdateBanner.tsx`
- `components/public/*` (footer, live demo modal, app download buttons)
- localStorage / sessionStorage / event keys prefixed `wiskul.` / `wiskul:` (rename via the brand prefix; low priority but visible in devtools)
- `frontend/index.html` (title, meta, OG tags, structured data)
- `public/manifest.json`, `public/.well-known/assetlinks.json`, `public/logo.png`, favicons, PWA icons

Other
- `.env`, `.env.example`, `frontend/.env.example` (`VITE_APP_NAME`, sender and contact emails, `WEBAUTHN_*`)
- `.github/workflows/android-apk.yml`, `android-signing-setup.yml` (`wiskulsl.com` URLs)
- `README.md`, `docs/*`

Finish with a sweep, which must come back empty (excluding `node_modules`, `.git`, `dist`):

```bash
grep -rniE "wiskul" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.kiro
```

## 5. Remove or hide platform-only features

These are for selling to schools, not for a single school.

- Public marketing pages: features, pricing, why, benefits, `LiveDemoModal`, `PublicFooter` marketing links. Replace with a simple login landing page (or redirect `/` to `/login`).
- Demo school and demo access flow (`demoAccessRoutes`, `demoAccessService`, `demoReadOnly`, `seedDemoTenant`).
- Newsletter and contact-to-WiSkul routes (`newsletterRoutes`, `contactRoutes`), or point them at the school's own inbox.
- Super admin UI and tenant management pages (keep the role in the DB for maintenance; hide it from the UI).
- Subscription, plans and platform billing: `subscriptionGuard`, `subscriptionCheckoutService`, platform receipts. Simplest: treat the single tenant as having an unlimited / all-features plan instead of deleting the guard.
- School self-registration. Seed the one school via the create-super-admin / tenant scripts instead.
- `appStatsRoutes` / app download buttons if no Android app is shipped.

Prefer a feature flag (`SINGLE_SCHOOL_MODE=true`) for gating so the same codebase can still be merged with fixes from the main platform later.

## 6. Single-tenant setup

1. Run `migrate:latest` on the NEW database only.
2. Create the one tenant row, the `schools` row (name, logo, address, contacts) and the principal account.
3. Optionally fix the tenant via env, e.g. `DEFAULT_TENANT_ID`, so no subdomain or domain resolution is needed.
4. Mark the tenant as verified and active, and give it the full plan (so `requireVerifiedSchool` and `subscriptionGuard` never block).
5. Do NOT copy any data from the production WiSkul database.

## 7. Email

- Add the client's sender domain to Brevo and configure SPF, DKIM and DMARC.
- Set `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `SUPPORT_EMAIL`, `INFO_EMAIL`, `NOREPLY_EMAIL`, `CONTACT_EMAIL`.
- Replace the platform logo used in emails and the email footer.
- Send a test of every email type: welcome, password reset, 2FA / verification, fee receipt, invoice, announcement, report card.

## 8. Domain, passkeys and security

- Point the client's domain at the new Vercel project.
- Set `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` to the new domain. Passkeys registered on another domain won't work.
- Update CORS / allowed origins and the CSP (`docs/CONTENT_SECURITY_POLICY.md`).
- Generate fresh `JWT_SECRET` and `ENCRYPTION_KEY`. Note that migration 171 uses `ENCRYPTION_KEY` to encrypt verification IDs, so set it BEFORE running migrations on the new DB.
- Update `vercel.json` / deploy workflow if they reference the old project or domain.

## 9. Android app (optional)

- New application ID / package name in `frontend/android/app/build.gradle`.
- Update `strings.xml` (app name), colors, launch screen, launcher and notification icons.
- Update `capacitor.config.json`, `assetlinks.json` (new package + new signing-key SHA-256), and `manifest.json`.
- New signing keystore (do not reuse the WiSkul one) and update the APK workflows' URLs and secrets.
- Build with the client's `VITE_API_URL`.

## 10. Documents that carry branding

Check each of these shows the school's name, logo and details, with no WiSkul footer:
- Report cards (`slReportCardService.ts`), ID cards (see `docs/IDENTITY_CARD_ENTERPRISE_UPGRADE.md`), fee receipts and invoices
- Backup exports (`backupService.ts`), CSV / Excel export filenames
- Email templates and PDF letterheads

## 11. QA checklist

- [ ] `grep -rniE "wiskul"` sweep returns nothing outside excluded folders
- [ ] `tsc --noEmit` passes (backend and frontend)
- [ ] `bash scripts/vercel-build.sh` with `VERCEL_ENV=preview` passes
- [ ] `vite build --mode app` in `frontend` passes
- [ ] Login for every role (principal, teacher, accountant, student, parent)
- [ ] Password reset and 2FA / passkey on the new domain
- [ ] Each email type received with the right sender, logo and footer
- [ ] PDFs: report card, ID card, receipt, invoice
- [ ] PWA install name / icon, browser tab title and favicon
- [ ] Payments with the client's credentials (test mode first)
- [ ] No marketing / demo / pricing routes reachable
- [ ] Backups run and the filename / title are branded correctly
- [ ] Android app (if included) installs, shows the right name and icon, and the deep links work

## 12. Handover and ongoing maintenance

- Hand over the admin account and rotate the initial passwords.
- Set up backups (`docs/BACKUPS.md`) and a Neon plan with enough history (the free plan only keeps 6 hours).
- Decide how fixes flow from the main platform into this copy (cherry-pick, or a `SINGLE_SCHOOL_MODE` branch kept rebased on main).
- Keep a short licence / support agreement with the school.
