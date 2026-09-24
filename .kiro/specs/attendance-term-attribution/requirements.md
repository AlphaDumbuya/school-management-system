# Requirements Document

## Introduction

Report cards display per-term attendance (On Time / Late / Absent). Today the
`attendance` table records only a date (`attendance_date`) and an
`academic_session_id`; it has no notion of which **term** a record belongs to.
The Sierra Leone report-card service therefore attributes each attendance record
to a term by splitting the academic year into three equal date ranges and
counting records that fall in each range.

This produces incorrect term attendance whenever the equal-thirds split does not
line up with the school's real term calendar. Observed failure: a school whose
`2026/2027` session starts 2026-09-15 has attendance recorded from 2026-07-22 to
2026-09-19. The equal-thirds split placed the whole of that attendance in the
computed "first term" window, so a **Second Term** result sheet showed
`On Time 0 · Late 0 · Absent 0` even though records exist.

This feature removes the date-window guesswork by storing the term on each
attendance record at the moment it is marked, and by making the report-card
service read attendance by that stored term. Existing records are backfilled so
historical report cards remain correct.

## Glossary

- **Term**: One of `first_term`, `second_term`, `third_term` — the existing
  `SL_TERMS` values used across results, ratings, and report-card tables.
- **Active term**: The term the school is currently operating in, used to stamp
  new attendance records at marking time.
- **Attendance record**: One row in the `attendance` table, identified by a
  student, a date, and a session type (e.g. morning/afternoon/full_day).
- **Term-resolution function**: A single function that maps a (tenant, academic
  year, date) tuple to a term value or NULL.
- **Term boundaries**: The start/end dates that define when each term begins and
  ends for a given academic year.
- **Backfill**: A one-time process that assigns a term to attendance records
  created before this feature existed.
- **Whole-year total**: The count of a student's attendance across all terms for
  a class and academic year, independent of term attribution.

## Requirements

### Requirement 1: Persist the term on each attendance record

**User Story:** As a school, I want each attendance record to carry the term it
belongs to, so that report cards attribute attendance to the correct term
without relying on date math.

#### Acceptance Criteria

1. THE attendance table SHALL have a `term` column that accepts the values
   `first_term`, `second_term`, `third_term`, or NULL.
2. WHEN a new attendance record is created THE system SHALL set `term` to the
   active term resolved for the record's date and tenant.
3. WHEN an existing attendance record's status is updated THE system SHALL
   re-resolve and set `term` to the active term for that record's date.
4. IF the active term cannot be resolved for a record THEN THE system SHALL
   store `term` as NULL and SHALL still create the attendance record.

### Requirement 2: Resolve the active term for a record

**User Story:** As a school administrator, I want the system to determine the
correct term for an attendance date, so that records are stamped consistently.

#### Acceptance Criteria

1. THE system SHALL provide a single term-resolution function that, given a
   tenant, an academic year, and a date, returns one of the three term values or
   NULL.
2. WHERE a tenant has configured explicit term boundaries THE resolution
   function SHALL use those boundaries.
3. WHERE no explicit term boundaries exist THE resolution function SHALL derive
   the term from the academic session date range using the existing term-window
   logic.
4. IF a date falls before the first configured or derived term boundary THEN
   THE resolution function SHALL resolve it to `first_term` (the first term has
   no lower bound).
5. IF a date falls after the last configured or derived term boundary THEN THE
   resolution function SHALL resolve it to `third_term` (the third term has no
   upper bound).

### Requirement 3: Report card reads attendance by stored term

**User Story:** As a parent or teacher, I want each term's result sheet to show
the attendance recorded during that term, so that the sheet reflects reality.

#### Acceptance Criteria

1. WHEN a report card is generated THE report-card service SHALL derive each
   term's attendance counts by filtering attendance records on their stored
   `term` value for the student, class, and academic year, and SHALL NOT use
   date-window splitting to attribute records to terms.
2. WHEN the report-card service computes the whole-year attendance total THE
   system SHALL count all of the student's attendance records for the class and
   academic year regardless of term.
3. THE whole-year attendance total SHALL equal the sum of the three per-term
   attendance totals plus any records whose `term` is NULL.
4. THE per-term attendance count SHALL classify each distinct calendar day by its
   best session status (present/excused over late over absent), preserving the
   current daily-classification behavior.

### Requirement 4: Backfill existing attendance records

**User Story:** As a school with historical attendance, I want existing records
assigned to a term, so that previously entered results and past report cards
show correct attendance.

#### Acceptance Criteria

1. WHEN the backfill runs THE system SHALL set `term` on every existing
   attendance row whose `term` is NULL.
2. THE backfill SHALL resolve each record's term using the same term-resolution
   function defined in Requirement 2.
3. THE backfill SHALL be idempotent, so running it more than once does not change
   already-populated `term` values.
4. IF a record's term cannot be resolved THEN THE backfill SHALL leave its `term`
   as NULL and SHALL continue processing the remaining records.

### Requirement 5: Attendance marking flows stamp the term

**User Story:** As a teacher marking the class register, I want my entries
attributed to the current term automatically, so that I do not have to choose a
term manually.

#### Acceptance Criteria

1. WHEN attendance is submitted through the single-record marking flow THE
   system SHALL stamp the resolved term on the created record.
2. WHEN attendance is submitted through the bulk/register marking flow THE
   system SHALL stamp the resolved term on every created record.
3. THE marking flows SHALL NOT require the user to select a term.
4. WHERE a record is created for a back-dated date THE system SHALL resolve the
   term from that record's date rather than from today's date.

### Requirement 6: No regression to existing attendance behavior

**User Story:** As an existing user, I want attendance marking, editing, and
analytics to keep working, so that adding term attribution does not break the
app.

#### Acceptance Criteria

1. THE attendance marking, editing, and listing endpoints SHALL continue to
   accept the same request payloads they accept today.
2. THE dashboards and analytics that count attendance without a term filter
   SHALL return the same totals as before this change.
3. THE `term` column SHALL be nullable so that any code path not yet updated can
   still insert an attendance record.
