# Design — Platform Newsletter & Marketing

## Overview
A compliant marketing layer on top of the existing platform communication hub.
Reuses the Brevo `sendEmail` transport and the branded email layout, but adds a
consent-aware subscriber list and a mandatory unsubscribe path.

Decisions (operator-approved defaults):
- Consent: **opt-out by default** — tenant contacts and contact-form submitters
  are added to the list but NOT marketing-opted-in; explicit opt-in via the
  public subscribe form or manual admin action.
- Send engine: **per-recipient loop via existing emailService** (small volumes,
  full control of the unsubscribe token). Brevo campaign API can be layered later.
- Audience: **schools + public prospects**.

## Data Models

Migration `122_newsletter.ts`:
- `newsletter_subscribers`:
  - `id` uuid pk
  - `email` unique (citext-ish; store lowercased)
  - `name` nullable
  - `source` — 'tenant' | 'contact' | 'public' | 'manual'
  - `tenant_id` nullable
  - `status` — 'subscribed' | 'unsubscribed' (default 'unsubscribed' for auto-added; 'subscribed' for explicit)
  - `unsubscribe_token` unique
  - `created_at`, `unsubscribed_at`
- `newsletter_campaigns`:
  - `id`, `sent_by`, `subject`, `body`, `segment` ('all'|'tenants'|'prospects'),
    `recipients_count`, `delivered_count`, `created_at`

## Components

### Service — `newsletterService.ts`
- `upsertSubscriber({ email, name?, source, tenantId?, optIn })` — idempotent; generates token if new; only flips to subscribed when optIn true.
- `unsubscribeByToken(token)` — mark unsubscribed.
- `list({ status?, search?, limit?, offset? })`, `counts()`.
- `setStatus(id, status)`.
- `sendCampaign(sentBy, { subject, body, segment })` — resolve opted-in subscribers by segment, send each a branded marketing email with an unsubscribe link built from `appUrl + /newsletter/unsubscribe?token=`, record campaign.
- `listCampaigns()`.

### Email layout
- `renderEmail` gains an optional `unsubscribeUrl`; when present, the footer shows an "Unsubscribe" link. Marketing emails always pass it.

### Routes
Public (no auth):
- `POST /api/newsletter/subscribe` { email, name? }
- `GET  /api/newsletter/unsubscribe?token=` → marks unsubscribed, returns a simple confirmation page/JSON.
Admin (super admin), under platform:
- `GET  /platform/newsletter/subscribers`
- `POST /platform/newsletter/subscribers` (manual add)
- `POST /platform/newsletter/subscribers/:id/status`
- `POST /platform/newsletter/campaign`
- `GET  /platform/newsletter/campaigns`

### Hooks into existing flows
- Tenant create + contact submit: also `upsertSubscriber({ optIn: false })` (best-effort).

### Frontend
- New **Newsletter** tab in `PlatformCommunicationPage` (Inbox | Broadcast | Newsletter): subscriber table (search/filter/add/unsubscribe), campaign composer (subject/body/segment), and campaign history.
- Public **UnsubscribePage** route `/newsletter/unsubscribe` that reads `?token=` and confirms.
- Optional subscribe box wiring on the marketing site (service method provided).

## Error Handling
- Public endpoints validate email; unsubscribe is idempotent and never leaks whether an email exists.
- Marketing sends skip unsubscribed/opted-out; failures are logged per recipient, never abort the batch.

## Correctness Properties
1. A marketing email is only sent to a subscriber whose status is 'subscribed'.
2. Every marketing email contains a working, token-based unsubscribe link.
3. Unsubscribe works without authentication and is idempotent.
4. Auto-added contacts are never marketed to until they explicitly opt in.
