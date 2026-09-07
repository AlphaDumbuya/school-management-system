# Implementation Plan — Platform Newsletter & Marketing

- [x] 1. Migration 122: newsletter_subscribers + newsletter_campaigns
  - _Requirements: 1, 3_

- [x] 2. newsletterService: upsert/unsubscribe/list/counts/setStatus/sendCampaign/listCampaigns
  - _Requirements: 1, 2, 3, 4_

- [x] 3. Email layout: optional unsubscribeUrl footer link
  - _Requirements: 2, 3_

- [x] 4. Public routes: subscribe + token unsubscribe; hook tenant-create (opt-in) & contact-submit (opt-out)
  - _Requirements: 1, 2_

- [x] 5. Admin platform routes: subscribers list/add/status, campaign send, campaign history
  - _Requirements: 3, 4_

- [x] 6. Frontend: platformService newsletter methods
  - _Requirements: 3, 4_

- [x] 7. Frontend: Newsletter tab in PlatformCommunicationPage (subscribers + composer + history)
  - _Requirements: 3, 4_

- [x] 8. Public footer subscribe wired to /api/newsletter/subscribe; backend serves the unsubscribe confirmation page
  - _Requirements: 2_

- [x] 9. Build backend + frontend green; migrations applied; existing tenants backfilled as opted-in subscribers
  - _Requirements: all_

## Notes
- Recipients are ONE email per school (the school's contact email) + public subscribers — never individual tenant users.
- Tenants are opted-in by default (customers); public/contact prospects are opt-out until they subscribe. Everyone can one-click unsubscribe.
