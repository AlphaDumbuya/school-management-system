# Phase 2.2 - Events Management Module Design

**Module:** Events Management  
**Phase:** 2.2  
**Status:** In Progress  
**Version:** 1.0  
**Date:** June 15, 2026

---

## 🏗️ SYSTEM ARCHITECTURE

### Component Overview
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Calendar   │  │Event Manager │  │  Analytics   │ │
│  │   Component  │  │  Component   │  │  Dashboard   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     API Layer                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Event Routes (/api/events)               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Event     │  │ Registration│  │  Recurring  │    │
│  │   Service   │  │   Service   │  │   Service   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Category   │  │ Attendance  │  │  Analytics  │    │
│  │   Service   │  │   Service   │  │   Service   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Database Layer                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PostgreSQL Tables (7 tables)                    │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🗄️ DATABASE DESIGN

### Table: events
```sql
CREATE TABLE events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL, -- 'single', 'multi_day', 'recurring'
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    all_day BOOLEAN DEFAULT false,
    location VARCHAR(255),
    location_type VARCHAR(50), -- 'on_campus', 'off_campus', 'virtual'
    venue_details TEXT,
    capacity INTEGER,
    organizer_id UUID NOT NULL REFERENCES users(user_id),
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'published', 'cancelled', 'completed'
    visibility VARCHAR(50) DEFAULT 'public', -- 'public', 'private', 'role_specific'
    registration_required BOOLEAN DEFAULT false,
    registration_deadline TIMESTAMP,
    approval_required BOOLEAN DEFAULT false,
    allow_guests BOOLEAN DEFAULT false,
    max_guests_per_registration INTEGER DEFAULT 0,
    image_url VARCHAR(500),
    external_link VARCHAR(500),
    reminder_enabled BOOLEAN DEFAULT true,
    reminder_intervals JSONB, -- [24, 1] hours before
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

CREATE INDEX idx_events_tenant ON events(tenant_id);
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_events_dates ON events(start_date, end_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_type ON events(event_type);
```

### Table: event_categories
```sql
CREATE TABLE event_categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    icon VARCHAR(50),
    is_system BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_event_categories_tenant ON event_categories(tenant_id);
```

### Table: event_category_mappings
```sql
CREATE TABLE event_category_mappings (
    event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
    category_id UUID REFERENCES event_categories(category_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (event_id, category_id)
);
```

### Table: event_registrations
```sql
CREATE TABLE event_registrations (
    registration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled', 'waitlist'
    rsvp_status VARCHAR(50), -- 'going', 'maybe', 'not_going'
    guests_count INTEGER DEFAULT 0,
    registration_data JSONB, -- Custom form responses
    approval_status VARCHAR(50), -- 'pending', 'approved', 'rejected'
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    attendance_status VARCHAR(50), -- 'present', 'absent', 'late', 'excused'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_user ON event_registrations(user_id);
CREATE INDEX idx_event_registrations_status ON event_registrations(status);
```

### Table: event_recurrence
```sql
CREATE TABLE event_recurrence (
    recurrence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    parent_event_id UUID REFERENCES events(event_id),
    recurrence_pattern VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
    recurrence_interval INTEGER DEFAULT 1,
    recurrence_days JSONB, -- [0,1,2,3,4,5,6] for days of week
    recurrence_end_date TIMESTAMP,
    recurrence_count INTEGER,
    exception_dates JSONB, -- Array of exception dates
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_event_recurrence_event ON event_recurrence(event_id);
CREATE INDEX idx_event_recurrence_parent ON event_recurrence(parent_event_id);
```

### Table: event_notifications
```sql
CREATE TABLE event_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    notification_type VARCHAR(50) NOT NULL, -- 'reminder', 'update', 'cancellation', 'confirmation'
    scheduled_time TIMESTAMP NOT NULL,
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    channels JSONB, -- ['email', 'sms', 'in_app']
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_event_notifications_event ON event_notifications(event_id);
CREATE INDEX idx_event_notifications_user ON event_notifications(user_id);
CREATE INDEX idx_event_notifications_scheduled ON event_notifications(scheduled_time, sent);
```

### Table: event_attendance
```sql
CREATE TABLE event_attendance (
    attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    attendance_method VARCHAR(50), -- 'manual', 'qr_code', 'automatic'
    marked_by UUID REFERENCES users(user_id),
    status VARCHAR(50) DEFAULT 'present', -- 'present', 'absent', 'late', 'excused'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_attendance_event ON event_attendance(event_id);
CREATE INDEX idx_event_attendance_user ON event_attendance(user_id);
```

---

## 🔧 SERVICE LAYER DESIGN

### EventService
**Responsibilities:**
- Event CRUD operations
- Event lifecycle management
- Event search and filtering
- Event duplication
- Event publishing workflow

**Key Methods:**
```typescript
- createEvent(data: CreateEventDTO): Promise<Event>
- updateEvent(eventId: string, data: UpdateEventDTO): Promise<Event>
- deleteEvent(eventId: string): Promise<void>
- getEvent(eventId: string): Promise<Event>
- listEvents(filters: EventFilters): Promise<PaginatedResult<Event>>
- publishEvent(eventId: string): Promise<Event>
- cancelEvent(eventId: string, reason: string): Promise<Event>
- completeEvent(eventId: string): Promise<Event>
- duplicateEvent(eventId: string): Promise<Event>
- searchEvents(query: string): Promise<Event[]>
```

### EventCategoryService
**Responsibilities:**
- Category management
- System categories initialization
- Category assignment to events

**Key Methods:**
```typescript
- createCategory(data: CreateCategoryDTO): Promise<EventCategory>
- updateCategory(categoryId: string, data: UpdateCategoryDTO): Promise<EventCategory>
- deleteCategory(categoryId: string): Promise<void>
- listCategories(tenantId: string): Promise<EventCategory[]>
- assignCategoriesToEvent(eventId: string, categoryIds: string[]): Promise<void>
- initializeSystemCategories(tenantId: string): Promise<void>
```

### EventRegistrationService
**Responsibilities:**
- Registration management
- RSVP tracking
- Capacity management
- Waitlist handling

**Key Methods:**
```typescript
- registerForEvent(eventId: string, userId: string, data: RegistrationDTO): Promise<Registration>
- cancelRegistration(registrationId: string): Promise<void>
- updateRSVPStatus(registrationId: string, status: RSVPStatus): Promise<Registration>
- approveRegistration(registrationId: string): Promise<Registration>
- rejectRegistration(registrationId: string, reason: string): Promise<Registration>
- getEventRegistrations(eventId: string): Promise<Registration[]>
- getUserRegistrations(userId: string): Promise<Registration[]>
- checkCapacity(eventId: string): Promise<CapacityInfo>
- moveFromWaitlist(eventId: string): Promise<void>
```

### EventRecurrenceService
**Responsibilities:**
- Recurring event generation
- Recurrence pattern processing
- Exception handling

**Key Methods:**
```typescript
- createRecurringEvent(data: RecurringEventDTO): Promise<Event[]>
- updateRecurringSeries(parentId: string, data: UpdateDTO): Promise<Event[]>
- updateSingleOccurrence(eventId: string, data: UpdateDTO): Promise<Event>
- deleteRecurringSeries(parentId: string): Promise<void>
- deleteSingleOccurrence(eventId: string): Promise<void>
- generateOccurrences(pattern: RecurrencePattern): Promise<Date[]>
- addExceptionDate(eventId: string, date: Date): Promise<void>
```

### EventAttendanceService
**Responsibilities:**
- Attendance tracking
- Check-in/check-out
- QR code generation for attendance
- Attendance reports

**Key Methods:**
```typescript
- markAttendance(eventId: string, userId: string, data: AttendanceDTO): Promise<Attendance>
- checkIn(eventId: string, userId: string): Promise<Attendance>
- checkOut(eventId: string, userId: string): Promise<Attendance>
- bulkMarkAttendance(eventId: string, attendances: BulkAttendanceDTO[]): Promise<void>
- getEventAttendance(eventId: string): Promise<Attendance[]>
- getUserAttendance(userId: string): Promise<Attendance[]>
- generateAttendanceQRCode(eventId: string): Promise<string>
- generateAttendanceReport(eventId: string): Promise<AttendanceReport>
```

### EventAnalyticsService
**Responsibilities:**
- Event statistics
- Attendance analytics
- RSVP conversion tracking
- Trend analysis

**Key Methods:**
```typescript
- getEventStats(eventId: string): Promise<EventStats>
- getOverallStats(tenantId: string, dateRange: DateRange): Promise<OverallStats>
- getCategoryStats(tenantId: string): Promise<CategoryStats[]>
- getAttendanceMetrics(eventId: string): Promise<AttendanceMetrics>
- getRSVPConversionRate(eventId: string): Promise<number>
- getPopularEvents(tenantId: string, limit: number): Promise<Event[]>
- getUpcomingEvents(userId: string): Promise<Event[]>
```

---

## 🔌 API DESIGN

### Event Endpoints

#### POST /api/events
Create a new event
```typescript
Request Body:
{
  title: string;
  description: string;
  event_type: 'single' | 'multi_day' | 'recurring';
  start_date: string (ISO);
  end_date: string (ISO);
  all_day: boolean;
  location: string;
  location_type: 'on_campus' | 'off_campus' | 'virtual';
  capacity?: number;
  categories: string[];
  registration_required: boolean;
  registration_deadline?: string (ISO);
  recurrence?: RecurrencePattern;
}

Response: 201 Created
{
  event_id: string;
  ...eventData
}
```

#### GET /api/events
List events with filters
```typescript
Query Parameters:
- page: number
- limit: number
- status: string
- category: string
- start_date: string
- end_date: string
- organizer_id: string
- search: string

Response: 200 OK
{
  events: Event[];
  total: number;
  page: number;
  limit: number;
}
```

#### GET /api/events/:eventId
Get event details
```typescript
Response: 200 OK
{
  event: Event;
  registrations_count: number;
  attendance_count: number;
  categories: EventCategory[];
}
```

#### PUT /api/events/:eventId
Update event
```typescript
Request Body: Partial<CreateEventDTO>
Response: 200 OK
```

#### DELETE /api/events/:eventId
Delete event
```typescript
Response: 204 No Content
```

#### POST /api/events/:eventId/register
Register for event
```typescript
Request Body:
{
  rsvp_status: 'going' | 'maybe';
  guests_count?: number;
  registration_data?: Record<string, any>;
}

Response: 201 Created
```

#### DELETE /api/events/:eventId/register
Cancel registration
```typescript
Response: 204 No Content
```

#### POST /api/events/:eventId/attendance
Mark attendance
```typescript
Request Body:
{
  user_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

Response: 201 Created
```

#### GET /api/events/calendar
Get calendar view
```typescript
Query Parameters:
- start_date: string
- end_date: string
- view: 'month' | 'week' | 'day'
- categories: string[]

Response: 200 OK
{
  events: Event[];
  date_range: { start: string; end: string };
}
```

#### GET /api/events/analytics
Get event analytics
```typescript
Query Parameters:
- start_date: string
- end_date: string
- category: string

Response: 200 OK
{
  total_events: number;
  total_registrations: number;
  average_attendance_rate: number;
  category_breakdown: CategoryStats[];
  trends: TrendData[];
}
```

### Category Endpoints

#### GET /api/events/categories
List categories
```typescript
Response: 200 OK
{
  categories: EventCategory[];
}
```

#### POST /api/events/categories
Create category
```typescript
Request Body:
{
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

Response: 201 Created
```

---

## 🎨 FRONTEND DESIGN

### Components Structure

```
src/components/events/
├── EventCreator.tsx          # Event creation form
├── EventEditor.tsx           # Event editing form
├── EventList.tsx             # List of events
├── EventCard.tsx             # Single event card
├── EventDetails.tsx          # Event details view
├── EventCalendar.tsx         # Calendar component
├── RSVPButton.tsx            # RSVP action button
├── RegistrationForm.tsx      # Registration form
├── AttendanceMarker.tsx      # Attendance marking
├── RecurrenceEditor.tsx      # Recurring event config
├── CategorySelector.tsx      # Category picker
└── EventAnalytics.tsx        # Analytics dashboard
```

### Pages

```
src/pages/events/
├── EventsPage.tsx            # Main events page
├── EventDetailsPage.tsx      # Event details
├── CalendarPage.tsx          # Calendar view
├── MyEventsPage.tsx          # User's events
└── EventAnalyticsPage.tsx    # Analytics dashboard
```

---

## 🔐 SECURITY DESIGN

### Access Control

**Event Creation:**
- Principal: All events
- Teacher: Department/class events
- Admissions Officer: Admission events

**Event Viewing:**
- Public events: All users
- Private events: Invited users only
- Role-specific: Based on user role

**Event Management:**
- Only organizer and principal can edit
- Only organizer and principal can delete
- Co-organizers can manage but not delete

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens
- Rate limiting on registration

---

## 📊 PERFORMANCE OPTIMIZATION

### Database Optimization
- Indexed columns: dates, status, tenant_id
- Materialized views for analytics
- Query result caching
- Connection pooling

### Caching Strategy
- Calendar data: 5-minute cache
- Event details: 2-minute cache
- Categories: 30-minute cache
- Analytics: 15-minute cache

### API Optimization
- Pagination for list endpoints
- Field selection
- Lazy loading for related data
- Response compression

---

## 🧪 TESTING STRATEGY

### Unit Tests
- Service layer methods
- Utility functions
- Data validation

### Integration Tests
- API endpoint testing
- Database operations
- Service interactions

### E2E Tests
- Event creation flow
- Registration flow
- Attendance marking flow
- Calendar navigation

---

## 📈 MONITORING & METRICS

### Key Metrics
- Event creation rate
- Registration conversion rate
- Attendance rate
- API response times
- Error rates
- User engagement

### Alerts
- High error rate
- Slow API response
- Failed notifications
- Database connection issues

---

**Document Version:** 1.0  
**Last Updated:** June 15, 2026  
**Next Review:** TBD
