# Requirements — Platform Newsletter & Marketing

## Introduction

The platform operator (super admin) needs to send marketing emails and newsletters
to an audience that includes both subscribed schools (tenants) and public prospects
(from the marketing site / contact form). Unlike operational broadcasts, marketing
email is legally regulated: it requires explicit consent tracking and a working
one-click unsubscribe on every message. This feature adds a compliant newsletter
subscriber list, public subscribe/unsubscribe, and an admin campaign composer.

## Glossary
- **Subscriber**: an email on the marketing list; may be a tenant contact or a public prospect.
- **Marketing opt-in**: explicit consent to receive marketing email (separate from being a SaaS customer).
- **Campaign**: one marketing/newsletter email sent to a segment of subscribers.
- **Unsubscribe token**: an unguessable per-subscriber token enabling one-click, no-login opt-out.

## Requirements

### Requirement 1: Compliant subscriber list
**User Story:** As the platform operator, I want a marketing subscriber list with consent state so that I only email people who agreed.

#### Acceptance Criteria
1. THE system SHALL store subscribers with email, optional name, source, optional tenant link, status (subscribed | unsubscribed), and a unique unsubscribe token.
2. WHEN a tenant is created or a contact form is submitted THE system SHALL upsert the contact as a subscriber that is opted OUT of marketing by default.
3. THE system SHALL never send marketing email to a subscriber who is not opted in / is unsubscribed.

### Requirement 2: Public subscribe & unsubscribe
**User Story:** As a visitor, I want to subscribe and later unsubscribe without logging in.

#### Acceptance Criteria
1. WHEN a visitor submits the subscribe form with a valid email THE system SHALL record an opted-in subscriber (idempotently).
2. WHEN a recipient clicks the unsubscribe link THE system SHALL mark them unsubscribed using their token, with no login required, and confirm on a public page.
3. Every marketing email SHALL contain a working unsubscribe link.

### Requirement 3: Campaign composer & sending
**User Story:** As the platform operator, I want to compose and send a newsletter to a segment.

#### Acceptance Criteria
1. WHEN the operator sends a campaign THE system SHALL deliver only to opted-in subscribers in the chosen segment (all | tenants | prospects).
2. THE system SHALL record each campaign with subject, segment, recipient count, delivered count, and timestamp.
3. THE system SHALL render marketing emails with the brand theme and an unsubscribe footer.

### Requirement 4: Admin management
**User Story:** As the platform operator, I want to view and manage subscribers and campaign history.

#### Acceptance Criteria
1. THE system SHALL list subscribers with search and status filter, and show counts.
2. THE operator SHALL be able to manually add or unsubscribe a subscriber.
3. THE system SHALL show a campaign send history.
