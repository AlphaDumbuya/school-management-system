# WiSkul Built-In Communications Transformation Roadmap

## Status

**State:** Proposed implementation roadmap  
**Owner:** WiSkul engineering  
**Scope:** Replace the SMS/WhatsApp communication experience with a tenant-isolated, in-app communication platform.  
**Non-goal:** No Twilio, WhatsApp, SMS, or other external messaging provider will be used for chat, announcements, or internal notifications.

Firebase Cloud Messaging (FCM) is permitted only as an optional operating-system push delivery channel. It must never be the source of truth and the product must remain fully usable when FCM is unavailable.

## Product Outcome

WiSkul becomes the school communication workspace: authenticated users exchange real-time messages, receive persistent notifications, participate in permitted groups, read announcements, and access all content within the tenant boundary. The resulting experience is comparable to a focused school-oriented combination of WhatsApp Web, Messenger, and Microsoft Teams.

## Existing Foundations and Constraints

| Area | Current state | Transformation implication |
| --- | --- | --- |
| Realtime | A Socket.IO `websocketService` exists for dashboard updates | Extend or replace it with a JWT-authenticated communication gateway; do not trust client-supplied user or role data. |
| Storage | A shared storage service supports local and S3-compatible storage with type/size validation | Reuse it for communication attachments, with tenant-scoped object keys and signed download authorization. |
| Authentication | JWT authentication and role authorization exist | Every REST request and socket connection must derive user ID, tenant ID, and role from the validated JWT. |
| Messaging | SMS/WhatsApp routes, services, jobs, tables, and dashboard exist | Freeze feature work on them, introduce the built-in platform alongside them, then retire them only after migration and retention conditions are met. |
| Roles | Current role enum lacks Vice Principal, Librarian, and Receptionist | Add missing roles or map them through a configurable permission system before messaging authorization is enabled. |
| Deployment | The current server entry point starts an HTTP app | Initialize Socket.IO from the HTTP server for persistent backend deployments; define an alternative real-time gateway for serverless environments. |

## Architecture Decisions

1. **Persistence is authoritative.** PostgreSQL records are created before real-time events are emitted. Socket.IO only accelerates delivery.
2. **Tenant identity is server-derived.** `tenant_id` is never accepted as a client authority and is present on every communication record.
3. **Authorization is conversation-specific.** Membership and messaging policy are checked for every API and socket action.
4. **Files are private.** Attachment metadata is stored in PostgreSQL; content is stored under tenant-scoped paths and accessed through short-lived, authorized URLs.
5. **Encryption at rest is layered.** Database/storage provider encryption is required. Encrypt message bodies and attachment encryption keys at the application layer with versioned tenant keys where contractual requirements demand it.
6. **Roles define defaults, permissions define behavior.** A role matrix seeds tenant defaults, while schools can refine allowed direct-message, group, announcement, moderation, and attachment actions.
7. **No provider fallback.** Failure to deliver FCM push must not send SMS, WhatsApp, or email. The in-app inbox remains the canonical delivery location.
8. **Auditability is mandatory.** Administrative moderation, membership, policy, announcement, and retention actions are logged without retaining decrypted secrets.

## Target Boundaries

### Backend Modules

- `communication` domain: conversation, membership, message, reaction, receipt, attachment, and moderation services.
- `announcements` domain: audience resolution, publication, acknowledgement, and expiry.
- `notifications` domain: persistent in-app notification center and event-to-notification mapping.
- `realtime` gateway: authenticated Socket.IO namespaces/rooms, presence, typing, delivery, read events, and fan-out.
- `push` adapter: FCM token lifecycle and push delivery only.
- `communication-policy` service: role defaults and tenant overrides.
- `communication-audit` service: immutable security and administration audit events.

### Frontend Modules

- Responsive communication workspace with a conversation list, message pane, details pane, and mobile navigation.
- Announcement composer and feed.
- Notification center, unread badge, archive, and delete controls.
- Shared components for message bubbles, receipts, reactions, replies, attachment previews, voice notes, member management, and search.

## Data Model

All tables include `tenant_id`, timestamps, foreign keys where appropriate, and tenant-leading indexes. UUIDs are preferred for public identifiers.

| Table | Essential fields and purpose |
| --- | --- |
| `communication_conversations` | `conversation_id`, `tenant_id`, `type` (`direct`, `group`, `announcement_discussion`), `title`, `created_by`, `last_message_at`, `archived_at` |
| `communication_conversation_members` | `conversation_id`, `tenant_id`, `user_id`, `member_role`, `joined_at`, `muted_until`, `last_read_message_id`, `removed_at` |
| `communication_messages` | `message_id`, `tenant_id`, `conversation_id`, `sender_id`, encrypted `body`, `body_key_version`, `reply_to_message_id`, `forwarded_from_message_id`, `status`, `deleted_at`, `edited_at` |
| `communication_message_receipts` | `tenant_id`, `message_id`, `user_id`, `delivered_at`, `read_at` |
| `communication_message_reactions` | `tenant_id`, `message_id`, `user_id`, `emoji`, `created_at` with a uniqueness constraint per user/message/emoji |
| `communication_attachments` | `attachment_id`, `tenant_id`, `message_id`, storage key, original name, MIME type, byte size, checksum, media metadata, scan status |
| `communication_message_pins` | `tenant_id`, `conversation_id`, `message_id`, `pinned_by`, `pinned_at`, `unpinned_at` |
| `communication_reports` | `tenant_id`, `message_id`, `reported_by`, category, detail, status, resolved_by, resolution |
| `communication_blocks` | `tenant_id`, `blocker_user_id`, `blocked_user_id`, `created_at` |
| `communication_presence` | `tenant_id`, `user_id`, `last_seen_at`, `availability`; connection counts remain transient in Redis/memory |
| `communication_typing` | Ephemeral Redis/socket state; do not persist as an application table unless audit requirements change |
| `communication_announcements` | `announcement_id`, `tenant_id`, author, title, rich body, audience definition, published/expiry timestamps, status |
| `communication_announcement_recipients` | Materialized tenant-safe recipient set with delivered/read/acknowledged timestamps |
| `notifications` | `notification_id`, `tenant_id`, `user_id`, event type, title, body, deep link, metadata, read/archive/delete timestamps |
| `communication_device_tokens` | `tenant_id`, `user_id`, device/platform/token hash, token ciphertext, last_seen_at, revoked_at |
| `communication_tenant_settings` | Tenant upload limits, allowed MIME types, retention policy, policy version, and feature toggles |
| `communication_role_permissions` | `tenant_id`, role, capability, allowed; supports tenant overrides over product defaults |

### Required Indexes and Constraints

- `(tenant_id, conversation_id, created_at DESC)` for message pagination.
- `(tenant_id, user_id, last_message_at DESC)` through membership/conversation access paths for inbox loading.
- `(tenant_id, user_id, read_at)` for unread notification and receipt queries.
- Unique direct-conversation key built from ordered participant IDs and `tenant_id`.
- Unique membership `(tenant_id, conversation_id, user_id)`.
- Database constraints preventing cross-tenant foreign-key relationships where the database supports composite tenant keys.
- Cursor pagination only for conversations, messages, announcements, and notifications; never offset-scan large tenant datasets.

## Permission Baseline

The policy service owns final permissions. The initial tenant defaults are:

| Role | Direct messages | Create groups | Publish announcements | Moderate groups | School-wide broadcast |
| --- | --- | --- | --- | --- | --- |
| Super Admin | Allowed | Allowed | Allowed | Allowed | Allowed |
| Principal | Allowed | Allowed | Allowed | Allowed | Allowed |
| Vice Principal | Allowed | Allowed | Allowed by policy | Allowed | Allowed by policy |
| Teacher | Parents/students/staff allowed by relationship policy | Department/class groups | Class/assigned audiences | Groups they manage | No |
| Parent | School/teachers and permitted parent groups | No by default | No | No | No |
| Student | Teachers and permitted classmates/groups | No by default | No | No | No |
| Accountant | Staff/parents for finance policy | Finance groups by policy | Finance audiences by policy | Own groups | No |
| Librarian | Staff/students/parents for library policy | Library groups by policy | Library audiences by policy | Own groups | No |
| Receptionist | Staff/parents for admissions/reception policy | Reception groups by policy | Reception audiences by policy | Own groups | No |

Relationship checks must prevent a teacher from messaging unrelated students/parents unless a school policy explicitly permits it. Group creation, membership changes, announcements, pinning, and deletion require named capabilities, not only a role comparison.

## Delivery Roadmap

### Phase 0: Discovery, Freeze, and Migration Contract

**Goal:** establish a safe boundary before new code changes behavior.

- Inventory all SMS/WhatsApp routes, jobs, tables, dashboards, templates, phone verification flows, and navigation entries.
- Mark SMS/WhatsApp features as deprecated and stop adding dependencies to them.
- Decide retention/export requirements for historical SMS data; do not copy phone numbers into chat contacts without a documented consent decision.
- Map existing notifications, assignment, attendance, exam, fee, library, and admission events to future internal notification event types.
- Confirm deployment topology for persistent Socket.IO connections, Redis availability, storage provider, virus scanning, and FCM credentials.
- Resolve role expansion or define mapping for Vice Principal, Librarian, and Receptionist.

**Exit criteria:** approved domain boundaries, migration/retention policy, deployment decision, and signed role/capability matrix.

### Phase 1: Security and Tenant Foundation

**Goal:** make cross-tenant message access structurally difficult and testable.

- Add communication migrations, tenant-leading indexes, soft-delete strategy, audit schema, and migration rollback tests.
- Implement tenant-scoped repository helpers that require tenant ID plus authenticated actor context.
- Add communication policy resolution with product defaults and tenant overrides.
- Establish message-body encryption strategy, key rotation format, and secrets handling.
- Add authorization helpers for conversation membership, relationship eligibility, and moderator authority.
- Extend role data, route guards, frontend role types, and seed fixtures for the new roles.

**Exit criteria:** tenant-isolation, authorization, and encryption-at-rest tests pass for repositories and services before any user-facing chat endpoint is enabled.

### Phase 2: Conversation and Message Core

**Goal:** deliver durable, secure one-to-one and group text chat without real-time enhancements.

- Build REST APIs to create/list direct and group conversations, manage authorized membership, paginate messages, send/edit/delete own messages, and fetch pinned messages.
- Enforce direct-message eligibility (teacher-parent, teacher-student, parent-school, principal-teacher, staff-staff) through relationship policy.
- Add replies, forwards, reactions, basic message status, server timestamps, and idempotency keys for send operations.
- Implement group lifecycle: authorized creation, title/photo, member invite/remove, mute member, exit group, and admin transfer.
- Add audit logs for administrative actions and moderation.
- Build a minimal responsive inbox and message composer using the REST APIs.

**Exit criteria:** REST-only chat works correctly across supported roles and cannot read or write another tenant's conversations.

### Phase 3: Real-Time Gateway, Presence, and Receipts

**Goal:** make live chat immediate while retaining correct durable behavior.

- Initialize Socket.IO from the HTTP server used by persistent deployments; do not initialize it from an Express app alone.
- Authenticate during the Socket.IO handshake using the existing JWT validation path. Reject client-provided tenant ID, role, or user ID.
- Join only server-authorized rooms: `tenant:{tenantId}`, `user:{userId}`, and `conversation:{conversationId}` after membership verification.
- Emit `message.created`, `message.updated`, `message.deleted`, `reaction.changed`, `receipt.delivered`, `receipt.read`, `typing.changed`, and `presence.changed` events with versioned payloads.
- Store last-seen and availability; use Redis with TTL for presence, typing, and multi-instance event fan-out.
- Add delivery/read acknowledgement APIs and socket events that write receipts idempotently.
- Implement reconnect recovery: cursor-fetch missed messages and recompute unread counts.

**Exit criteria:** two browser sessions receive messages, typing, presence, delivery, and read events live; reconnecting clients recover without duplicate messages.

### Phase 4: Attachments, Voice Notes, Search, and Rich Interaction

**Goal:** support practical school communication content safely.

- Build a communication-specific upload endpoint on top of the shared storage service.
- Enforce configurable tenant upload size, allowed MIME types, extension/MIME consistency, checksum, private paths, authorization, and malware-scan status before sharing.
- Support images, PDF, Word, Excel, PowerPoint, ZIP, audio, and video with safe previews/downloads.
- Implement browser voice capture, audio transcoding/validation strategy, playback, duration/waveform metadata, and accessibility labels.
- Add search by keyword, person, date range, group, and attachment presence. Start with PostgreSQL full-text search; add a dedicated search index only when measured load requires it.
- Add emoji reactions, replies, forwarding, pinned messages, attachment indicators, and deep links.

**Exit criteria:** supported files and voice notes are private, tenant-scoped, virus-scan aware, and searchable; no attachment URL bypasses authorization.

### Phase 5: Announcements and Internal Notification Center

**Goal:** move school broadcasts and operational alerts into WiSkul.

- Implement announcement authoring with rich text, links, images, PDFs/documents, drafts, scheduling, expiry, audience preview, and delivery counts.
- Resolve audiences server-side for entire school, class/stream, teachers, parents, staff, students, and policy-defined groups; materialize recipients at publication time.
- Create a persistent notification center with unread count, mark-read, archive, delete, notification preferences, and deep links.
- Publish internal notifications for assignments, exams, fees, attendance, results, library due dates, and admission decisions.
- Ensure each domain event is idempotent and has a traceable origin/audit event.

**Exit criteria:** every listed school event reaches the in-app notification center and target announcements reach only intended tenant recipients.

### Phase 6: FCM Push Adapter

**Goal:** add best-effort push alerts for backgrounded browser and mobile clients without coupling the platform to any external chat provider.

- Implement device registration, token refresh/revocation, encrypted token storage, and user consent controls.
- Send minimal push payloads containing a notification ID/deep link; fetch protected content only after the app authenticates.
- Respect per-user and per-tenant notification preferences, quiet hours, and device/platform rules.
- Handle token invalidation, retries, observability, and push-delivery failure without duplicate in-app notifications.
- Build web service-worker and mobile integration paths; feature-flag each platform independently.

**Exit criteria:** backgrounded clients receive an opt-in push, revoked tokens are not retried, and disabled FCM does not affect in-app delivery.

### Phase 7: Moderation, Governance, and Operational Hardening

**Goal:** make the platform safe for a school environment.

- Implement block user, report message, delete own message, moderator/admin deletion, mute/remove member, content retention, legal hold, and export policies.
- Add moderation queues, case resolution, policy rationale, and immutable audit trails.
- Add rate limits, message/attachment quotas, spam controls, duplicate-send protection, abusive-content scanning hooks, and safe logging rules.
- Add school communication settings for permissions, file limits, allowed content, retention, notification preferences, and feature flags.
- Define incident response, backup/restore, encryption-key rotation, monitoring dashboards, and SLOs for REST, sockets, storage, and push.

**Exit criteria:** moderation and tenant-administration actions are permissioned, audited, tested, and operationally observable.

### Phase 8: Production UX and Accessibility

**Goal:** complete the WhatsApp-Web-like experience without losing school workflow efficiency.

- Deliver desktop three-pane layout and mobile navigation, conversation filters, unread badges, pinned/search views, and responsive attachment/voice controls.
- Support light/dark themes, keyboard navigation, focus management, screen-reader labels, reduced-motion behavior, and localization-ready time/date formatting.
- Add loading, offline, reconnecting, empty, permission-denied, upload-progress, and failure states.
- Build admin/group-management and announcement composition surfaces using the established design system.
- Add analytics that measure aggregate product health without exposing message content.

**Exit criteria:** keyboard and mobile acceptance tests pass, text never overflows controls, and core conversations remain usable on poor connections.

### Phase 9: Cutover and Legacy Removal

**Goal:** remove SMS/WhatsApp as a product dependency without accidental data loss.

- Release built-in communication behind per-tenant feature flags and pilot with selected schools.
- Run dual-read reporting only where needed for historical dashboards; do not dual-send communications externally.
- Provide users with an in-product migration notice and clear replacement paths for prior SMS tasks.
- Archive or export legacy provider configuration and historical message records according to approved retention policy.
- Remove navigation, routes, background delivery jobs, webhook endpoints, provider credentials, tests, docs, migrations only after retention/export obligations are met.
- Remove Twilio/WhatsApp/SMS environment variables and dependency code; keep optional integration interfaces generic for future adapters.

**Exit criteria:** no runtime path requires external SMS/WhatsApp configuration, all tenant communication workflows operate in-app, and legacy removal passes regression/security testing.

## API and Socket Contract Plan

### REST Resource Families

- `/api/v1/communications/conversations`
- `/api/v1/communications/conversations/:conversationId/messages`
- `/api/v1/communications/conversations/:conversationId/members`
- `/api/v1/communications/messages/:messageId/reactions`
- `/api/v1/communications/messages/:messageId/attachments`
- `/api/v1/communications/messages/:messageId/report`
- `/api/v1/communications/announcements`
- `/api/v1/communications/notifications`
- `/api/v1/communications/devices`
- `/api/v1/communications/settings`
- `/api/v1/communications/search`

Every endpoint authenticates, derives tenant context from the JWT, validates request schemas, authorizes the action, emits an audit event when appropriate, and returns a stable pagination/error envelope.

### Socket Contract

- Namespace: `/communications`.
- Handshake: bearer JWT only; server validates token and tenant status.
- Client events: `conversation.join`, `conversation.leave`, `typing.start`, `typing.stop`, `message.delivered`, `message.read`.
- Server events: `conversation.updated`, `message.created`, `message.updated`, `message.deleted`, `message.reaction`, `message.receipt`, `typing.changed`, `presence.changed`, `notification.created`.
- The server ignores untrusted room names and derives allowable rooms from membership queries.
- All event payloads are versioned and contain public IDs, tenant-safe data only, and an event timestamp.

## Test and Quality Gates

| Layer | Required checks |
| --- | --- |
| Database | Migration up/down tests, tenant composite constraints, pagination/index plans, encryption serialization tests |
| Services | Permission matrix tests, direct-message relationship tests, moderation, receipts, reactions, forwarding, and notification idempotency |
| APIs | Authentication, tenant-isolation, malformed input, authorization, cursor pagination, file access, and rate-limit integration tests |
| Realtime | Invalid JWT rejection, unauthorized room join rejection, multi-instance fan-out, reconnect recovery, typing TTL, and receipt idempotency |
| Frontend | Component tests for inbox, composer, attachments, reactions, voice notes, unread state, offline/reconnect, and role visibility |
| Security | Cross-tenant penetration scenarios, IDOR tests, private-object access tests, XSS-safe rich text, MIME spoofing, malware-scan failure, and audit-log checks |
| Performance | Targeted load tests for conversation lists, message fan-out, announcement audience fan-out, search, and presence under concurrent tenant load |

## Release Controls and Metrics

- Tenant feature flags for core chat, attachments, voice notes, announcements, notifications, and FCM.
- Kill switches for socket delivery, attachment download, voice upload, and push delivery; persistence remains available where safe.
- Metrics: message write latency, socket delivery latency, receipt latency, unread backlog, active connections, failed authorization attempts, upload scan failures, FCM failures, and tenant-isolation alerts.
- SLO proposal: $99.9\%$ successful persisted message writes; p95 message write under $300\text{ ms}$ excluding upload; p95 live fan-out under $1\text{ s}$ on a healthy connected client.

## Implementation Order

1. Phase 0 and Phase 1 before UI work.
2. Phase 2 REST core and tenant/permission tests.
3. Phase 3 real-time gateway and reconnect behavior.
4. Phase 4 attachments/voice/search.
5. Phase 5 announcements/notification center.
6. Phase 6 FCM after in-app notifications are stable.
7. Phase 7 and Phase 8 hardening/UX in parallel only after stable contracts.
8. Phase 9 only after pilot acceptance, retention approval, and a rollback plan.

## Explicit Non-Goals for the First Release

- End-to-end encryption that prevents authorized school compliance/moderation access.
- External SMS, WhatsApp, email, or telecom fallback delivery.
- Video calling, live classroom streaming, or arbitrary public communities.
- Importing legacy SMS messages into new conversations without a separate consent, privacy, and retention review.

## Next Decision Required

Before implementation begins, approve:

1. The persistent Socket.IO deployment target and Redis availability.
2. The encryption/key-management approach and retention period.
3. The full role expansion and initial tenant permission defaults.
4. The object-storage/malware-scanning design and initial upload limits.
5. The pilot tenants and legacy SMS/WhatsApp sunset date.