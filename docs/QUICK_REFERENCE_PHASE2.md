# Phase 2 - Quick Reference Guide

## What's Done

### Phase 2.1: Identity Management ✅
- **Status**: Backend 100%, Frontend 40%
- **Services**: 6 services
- **Endpoints**: 20+ working
- **Database**: Migration 022 ready
- **Try**: `GET /api/v1/id-cards` or `GET /api/v1/card-templates`

### Phase 2.2: Events Management ✅
- **Status**: Backend 100%, Frontend pending
- **Services**: 6 services (47 methods)
- **Endpoints**: 28+ registered and working
- **Database**: Migration 024 ready
- **Jobs**: 7 scheduled tasks active
- **Try**: `GET /api/v1/events` or `POST /api/v1/events` (with auth)

### Phase 2.3: Discipline & Conduct 🔄
- **Status**: Database & Design 100%, Services pending
- **Database**: Migration 025 ready to run
- **Tables**: 10 comprehensive tables designed
- **Types**: 15 TypeScript interfaces ready
- **Next**: Implement 7 backend services

### Phase 2.4: SMS & WhatsApp ⏳
- **Status**: Not started
- **Priority**: After Phase 2.3 services

---

## Quick Start

### For Testing Phase 2.2 Events API

```bash
# Start backend (in backend folder)
npm run start

# Create event
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "School Assembly",
    "description": "Monthly assembly",
    "event_type": "single",
    "start_date": "2026-07-20T09:00:00Z",
    "end_date": "2026-07-20T10:00:00Z",
    "location": "Main Hall",
    "capacity": 500
  }'

# List events
curl http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get event details
curl http://localhost:3000/api/v1/events/{eventId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### For Phase 2.3 Discipline Module

```bash
# Apply migration
npm run migrate

# Then test endpoints:
# POST /api/v1/discipline/infractions
# GET /api/v1/discipline/infractions/:studentId
# POST /api/v1/discipline/actions
# GET /api/v1/discipline/reports/:studentId
# etc.
```

---

## Key Files by Module

### Phase 2.1 (Identity)
```
Backend:
├── src/services/idCardService.ts
├── src/services/cardTemplateService.ts
├── src/services/printConfigService.ts
├── src/routes/idCardRoutes.ts
└── src/database/migrations/022_phase2_1_identity_management.ts

Types:
└── src/types/idCard.ts

Docs:
├── docs/PHASE2_1_IDENTITY_IMPLEMENTATION.md
└── docs/LOCAL_SETUP_GUIDE.md
```

### Phase 2.2 (Events)
```
Backend:
├── src/services/eventService.ts
├── src/services/eventRegistrationService.ts
├── src/services/eventAttendanceService.ts
├── src/services/eventAnalyticsService.ts
├── src/routes/eventRoutes.ts
├── src/jobs/eventManagementJobs.ts
└── src/database/migrations/024_phase2_2_events_management.ts

Types:
└── src/types/event.ts

Docs:
├── docs/PHASE2_2_EVENTS_IMPLEMENTATION_COMPLETE.md
└── docs/PHASE_2_DATABASE_GUIDE.md
```

### Phase 2.3 (Discipline)
```
Backend (PENDING):
├── src/services/disciplineService.ts (to create)
├── src/services/infractionService.ts (to create)
├── src/services/disciplineActionService.ts (to create)
├── src/routes/disciplineRoutes.ts (to create)
└── src/database/migrations/025_phase2_3_discipline_conduct.ts ✅

Types:
└── src/types/discipline.ts ✅

Docs:
├── docs/PHASE2_3_DISCIPLINE_CONDUCT_DESIGN.md ✅
└── docs/PHASE2_3_DISCIPLINE_CONDUCT_DESIGN.md ✅
```

---

## API Endpoint Categories

### Phase 2.2 Event Endpoints

```
Event Management
POST   /api/v1/events
GET    /api/v1/events
GET    /api/v1/events/:eventId
PUT    /api/v1/events/:eventId
DELETE /api/v1/events/:eventId
POST   /api/v1/events/:eventId/publish
POST   /api/v1/events/:eventId/cancel
POST   /api/v1/events/:eventId/complete

Registration
POST   /api/v1/events/:eventId/register
GET    /api/v1/events/:eventId/registrations
PUT    /api/v1/events/:eventId/registrations/:regId/rsvp
POST   /api/v1/events/:eventId/registrations/:regId/approve

Attendance
POST   /api/v1/events/:eventId/attendance
GET    /api/v1/events/:eventId/attendance
POST   /api/v1/events/:eventId/attendance/check-in
POST   /api/v1/events/:eventId/attendance/check-out

Analytics
GET    /api/v1/events/analytics/dashboard
GET    /api/v1/events/view/calendar
GET    /api/v1/events/view/upcoming
```

### Phase 2.3 Discipline Endpoints (TO BE CREATED)

```
Infractions
POST   /api/v1/discipline/infractions
GET    /api/v1/discipline/infractions/:studentId
PUT    /api/v1/discipline/infractions/:infractionId
GET    /api/v1/discipline/infractions/:infractionId

Actions
POST   /api/v1/discipline/actions
GET    /api/v1/discipline/actions/:studentId
PUT    /api/v1/discipline/actions/:actionId

Reports
GET    /api/v1/discipline/reports/:studentId
GET    /api/v1/discipline/analytics

Appeals
POST   /api/v1/discipline/appeals
GET    /api/v1/discipline/appeals/:studentId
PUT    /api/v1/discipline/appeals/:appealId
```

---

## Database Migrations Ready

```
Migration 022 (APPLIED): Identity Management
Migration 023 (APPLIED): Print Configs
Migration 024 (APPLIED): Events Management
Migration 025 (READY):   Discipline & Conduct
```

### To Run Migration 025
```bash
cd backend
npx knex migrate:latest
```

---

## Scheduled Jobs Status

### Currently Active (Phase 2.2)
```
1. Recurring Events          Every day at 2:00 AM
2. 24-Hour Reminders        Every day at 9:00 AM
3. 1-Hour Reminders         Every hour
4. Analytics Aggregation    Every hour
5. Event Cleanup            Every Sunday 3:00 AM
6. Event Reports            Every day at 1:00 AM
7. No-Show Analysis         Every day at 4:00 AM
```

### To Enable/Disable
```bash
# In .env
ENABLE_SCHEDULED_JOBS=true  # Enable scheduled jobs

# Automatically enabled in production
NODE_ENV=production
```

---

## Services Architecture

### Phase 2.2 Services

| Service | Methods | Purpose |
|---------|---------|---------|
| EventService | 12 | Core event management |
| EventCategoryService | 6 | Event categorization |
| EventRegistrationService | 11 | RSVP and capacity |
| EventAttendanceService | 7 | Check-in tracking |
| EventAnalyticsService | 7 | Statistics |
| EventRecurrenceService | 4 | Recurring events |

### Phase 2.3 Services (TO CREATE)

| Service | Methods | Purpose |
|---------|---------|---------|
| DisciplineService | ~8 | Core discipline |
| InfractionService | ~10 | Infraction recording |
| DisciplineActionService | ~10 | Action assignment |
| DetentionService | ~8 | Detention tracking |
| AppealService | ~8 | Appeal management |
| ConductReportService | ~6 | Report generation |
| DisciplineAnalyticsService | ~8 | Analytics |

---

## Type Definitions

### Phase 2.2 Event Types
```typescript
interface Event
interface EventCategory
interface EventRegistration
interface EventAttendance
interface EventAnalytics
// Plus: Create/Query/Stats interfaces
```

### Phase 2.3 Discipline Types ✅
```typescript
interface ConductRule
interface InfractionType
interface StudentInfraction
interface DisciplineAction
interface DetentionRecord
interface BehavioralNote
interface DisciplineAppeal
interface ConductReport
interface ConductAnalytics
// Plus: Create/Query/Stats interfaces
```

---

## Common Tasks

### Task 1: List All Events
```bash
curl http://localhost:3000/api/v1/events?page=1&limit=20 \
  -H "Authorization: Bearer $TOKEN"
```

### Task 2: Register for Event
```bash
curl -X POST http://localhost:3000/api/v1/events/{eventId}/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "pending"}'
```

### Task 3: Check In to Event
```bash
curl -X POST http://localhost:3000/api/v1/events/{eventId}/attendance/check-in \
  -H "Authorization: Bearer $TOKEN"
```

### Task 4: Get Event Analytics
```bash
curl http://localhost:3000/api/v1/events/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

### Task 5: View Event Calendar
```bash
curl "http://localhost:3000/api/v1/events/view/calendar?start_date=2026-07-01&end_date=2026-07-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing Checklist

### Phase 2.2 Events (READY TO TEST)
- [ ] Create event
- [ ] List events with pagination
- [ ] Get event details
- [ ] Update event
- [ ] Publish event
- [ ] Register for event
- [ ] View registrations
- [ ] Check in to event
- [ ] View attendance
- [ ] Get analytics
- [ ] View calendar

### Phase 2.3 Discipline (AFTER SERVICES)
- [ ] Record infraction
- [ ] Assign discipline action
- [ ] Schedule detention
- [ ] Record behavioral note
- [ ] Submit appeal
- [ ] View conduct report
- [ ] Access analytics

---

## Common Issues & Solutions

### Issue: "Cannot find module eventService"
**Solution**: Check import path uses `.js` extension for ES modules

### Issue: "EventRoutes not registered"
**Solution**: Verify `app.use('/api/v1/events', eventRoutes)` in index.ts

### Issue: "Scheduled jobs not running"
**Solution**: Check `ENABLE_SCHEDULED_JOBS=true` in .env

### Issue: "Migration 025 fails"
**Solution**: Ensure all previous migrations (022-024) have run first

---

## Environment Variables

```bash
# For Event Jobs
ENABLE_SCHEDULED_JOBS=true      # Enable scheduled jobs
NODE_ENV=production              # Auto-enables jobs

# For Event System
EVENT_REMINDER_ENABLED=true      # Enable reminders
EVENT_ANALYTICS_ENABLED=true     # Enable analytics
EVENT_QR_CODE_ENABLED=true       # Enable QR codes

# For Discipline System (coming soon)
DISCIPLINE_TRACKING_ENABLED=true
DISCIPLINE_ANALYTICS_ENABLED=true
DISCIPLINE_APPEALS_ENABLED=true
```

---

## Next Developer Session

1. **Create Phase 2.3 Services** (4-5 hours)
   - 7 services total
   - ~2,500 lines
   - Reference: `docs/PHASE2_3_DISCIPLINE_CONDUCT_DESIGN.md`

2. **Create Phase 2.3 Routes** (2-3 hours)
   - 30+ endpoints
   - Reference: `backend/src/routes/eventRoutes.ts` as template

3. **Create Phase 2.3 Jobs** (1-2 hours)
   - Reference: `backend/src/jobs/eventManagementJobs.ts` as template

4. **Testing & Integration** (2-3 hours)
   - Test all endpoints
   - Verify job execution
   - Integration testing

---

## Documentation Files to Read

**For Phase 2.2 Deep Dive**
- `docs/PHASE2_2_EVENTS_IMPLEMENTATION_COMPLETE.md` (Status & architecture)
- `docs/PHASE_2_DATABASE_GUIDE.md` (Schema details)

**For Phase 2.3 Deep Dive**
- `docs/PHASE2_3_DISCIPLINE_CONDUCT_DESIGN.md` (Complete design)
- `backend/src/types/discipline.ts` (Type definitions)

**For Phase 2 Overall**
- `docs/PHASE2_STATUS_UPDATE_JULY13.md` (Current status)
- `docs/PHASE2_COMPLETION_STRATEGY.md` (Roadmap)

---

## Phase 2 Progress

```
┌─────────────────────────────────────────────────┐
│ Phase 2.1 (Identity): ████████████ 100% ✅    │
├─────────────────────────────────────────────────┤
│ Phase 2.2 (Events):   ████████████ 100% ✅    │
├─────────────────────────────────────────────────┤
│ Phase 2.3 (Discipline): ██░░░░░░░░ 20% 🔄     │
├─────────────────────────────────────────────────┤
│ Phase 2.4 (SMS):      ░░░░░░░░░░░ 0%  ⏳      │
├─────────────────────────────────────────────────┤
│ Overall Phase 2:      ██████████░ 67% 🚀      │
└─────────────────────────────────────────────────┘
```

---

**Last Updated**: July 13, 2026  
**Next Update**: After Phase 2.3 Services  
**Overall Status**: On Track for Phase 2 Completion
