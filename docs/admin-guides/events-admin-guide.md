# Events Management - Administrator Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Event Creation](#event-creation)
3. [Event Management](#event-management)
4. [Registration Management](#registration-management)
5. [Attendance Tracking](#attendance-tracking)
6. [Analytics & Reporting](#analytics--reporting)
7. [Category Management](#category-management)
8. [Recurring Events](#recurring-events)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

This guide is for school administrators, principals, and event coordinators who manage events in the School Management System. You'll learn how to create, manage, and analyze events effectively.

### Administrator Roles

**Principal / Super Admin:**
- Full access to all event features
- Can create, edit, delete any event
- Approve/reject registrations
- Access all analytics

**Teachers / Event Coordinators:**
- Create and manage their own events
- Mark attendance for their events
- View registration lists
- Basic analytics for their events

**Admissions Officers:**
- Create admission-related events
- Manage parent meeting events
- View relevant analytics

---

## Event Creation

### Creating a Basic Event

1. **Navigate to Events**
   - Click **Events** in main menu
   - Click **+ Create Event** button

2. **Fill Basic Information**
   ```
   Title: Annual Science Fair 2026
   Description: Students showcase their science projects
   Event Type: Academic
   ```

3. **Set Date & Time**
   - Start Date & Time
   - End Date & Time
   - Timezone (auto-detected)

4. **Location Details**
   - Physical Location: "Science Building, Room 101"
   - Virtual Link: https://meet.school.local/science-fair (optional)
   - Map Link: (optional, for large venues)

5. **Capacity Settings**
   - Total Capacity: 200
   - Enable Waitlist: Yes/No
   - Allow Guests: Yes/No
   - Max Guests per Registration: 2

6. **Registration Settings**
   - Requires Approval: Yes/No
   - Registration Deadline: (optional)
   - Custom Registration Fields: (add if needed)

7. **Visibility & Access**
   - Is Public: Yes (visible to all)
   - Target Roles: Students, Parents, Teachers
   - Target Grades: Grade 9-12 (optional filter)

8. **Additional Options**
   - Featured Image: Upload event poster
   - Tags/Keywords: science, fair, projects
   - Categories: Academic Events, Student Activities

9. **Save as Draft or Publish**
   - **Draft**: Save for later editing
   - **Publish**: Make immediately visible

### Event Types & Their Uses

| Type | Use Case | Examples |
|------|----------|----------|
| **Academic** | Educational activities | Lectures, Workshops, Presentations |
| **Sports** | Physical activities | Matches, Tournaments, Practice |
| **Cultural** | Arts and culture | Concerts, Drama, Art Exhibition |
| **Parent Meeting** | Parent engagement | PTM, Town Halls, Orientation |
| **Administrative** | School operations | Assembly, Staff Meeting, Training |
| **Exam** | Assessments | Tests, Examinations, Evaluations |
| **Holiday** | Non-working days | Vacation, Holidays, Breaks |
| **Other** | Miscellaneous | Field Trips, Special Events |

### Creating Virtual Events

For online-only or hybrid events:

1. Enable **Virtual Event** option
2. Add meeting link (Zoom, Teams, Google Meet)
3. Include:
   - Meeting ID
   - Password (if required)
   - Join instructions
4. Consider:
   - Time zones for international participants
   - Tech requirements (browser, app)
   - Support contact for technical issues

### Event Templates

**Save Time with Templates:**

1. Create a template from existing event:
   - Open successful event
   - Click **Save as Template**
   - Name template: "Monthly Assembly Template"

2. Use template for new event:
   - Click **Create from Template**
   - Select template
   - Modify dates and specific details
   - Publish

**Common Templates:**
- Weekly Assembly
- Monthly Parent Meeting
- Quarterly Exam Schedule
- Annual Sports Day
- Semester Orientation

---

## Event Management

### Event Lifecycle

```
Draft → Published → In Progress → Completed
                ↓
            Cancelled
```

### Publishing Events

**Before Publishing Checklist:**
- [ ] All details filled correctly
- [ ] Dates and times verified
- [ ] Capacity set appropriately
- [ ] Location confirmed
- [ ] Featured image uploaded
- [ ] Registration settings configured
- [ ] Notifications enabled

**To Publish:**
1. Open draft event
2. Review all details
3. Click **Publish Event**
4. Confirmation popup
5. Automatic notifications sent to target audience

### Editing Published Events

**Minor Changes** (no notification):
- Description updates
- Adding more details
- Fixing typos

**Major Changes** (sends notification):
- Date/time changes
- Location changes
- Capacity changes
- Cancellation

**How to Edit:**
1. Find event in events list
2. Click **Edit** (pencil icon)
3. Make changes
4. Click **Save Changes**
5. Choose to notify registrants: Yes/No

### Duplicating Events

For similar or recurring events:

1. Find event to duplicate
2. Click **⋮** (more options)
3. Select **Duplicate**
4. System creates copy with "(Copy)" suffix
5. Edit details (especially dates)
6. Save as draft or publish

### Cancelling Events

**When to Cancel:**
- Weather/emergency situations
- Insufficient registrations
- Venue unavailable
- Organizer unavailable

**How to Cancel:**
1. Open event
2. Click **Cancel Event**
3. **Required**: Provide cancellation reason
4. Optional: Offer alternative (reschedule info)
5. Confirm cancellation

**What Happens:**
- All registrants notified immediately
- Event marked as "Cancelled"
- Registrations remain (for record)
- Event stays visible but grayed out
- Can be "Un-cancelled" if needed

### Archiving Events

Old events clutter the calendar:

1. **Auto-Archive** (recommended):
   - Events auto-archive 30 days after completion
   - Configurable in Settings

2. **Manual Archive**:
   - Select multiple completed events
   - Click **Archive Selected**
   - Events moved to archive (still accessible)

3. **Restore from Archive**:
   - Go to **Events** → **Archived**
   - Select event
   - Click **Restore**

---

## Registration Management

### Viewing Registrations

1. Open event details
2. Click **Registrations** tab
3. See complete list with:
   - User name and role
   - RSVP status (Going, Maybe, Not Going)
   - Registration date
   - Guest count
   - Approval status
   - Custom field responses

### Filtering Registrations

Filter by:
- **RSVP Status**: Going, Maybe, Not Going
- **Approval Status**: Pending, Approved, Rejected
- **Registration Date**: Date range
- **Waitlist Status**: Yes/No
- **Check-in Status**: Checked In, Not Checked In

### Approving Registrations

For events requiring approval:

1. Go to **Registrations** → **Pending**
2. Review registration details
3. Options:
   - **Approve**: User can attend
   - **Reject**: User cannot attend (provide reason)
   - **Request More Info**: Ask for clarification

**Bulk Approval:**
1. Select multiple registrations
2. Click **Approve Selected**
3. Confirm action
4. All selected users notified

### Managing Waitlist

**Viewing Waitlist:**
- Separate tab: **Registrations** → **Waitlist**
- Ordered by signup time (first-come-first-served)
- Shows position in waitlist

**Promoting from Waitlist:**

**Automatic** (recommended):
- System auto-promotes when spot available
- Next person notified
- 24-hour confirmation window

**Manual**:
1. Select person from waitlist
2. Click **Promote to Registered**
3. User notified immediately
4. They must confirm within deadline

**Custom Waitlist Rules:**
- Priority by grade level
- Priority by role (e.g., seniors first)
- Priority by registration date
- Manual selection

### Exporting Registration Data

**Excel/CSV Export:**
1. Go to **Registrations**
2. Click **Export** button
3. Choose format: Excel or CSV
4. Select fields to include
5. Download file

**Useful for:**
- Printing attendance sheets
- Creating name badges
- External analysis
- Record keeping
- Meal planning (guest count)

### Communication with Registrants

**Send Message to All Registrants:**
1. Go to event **Registrations**
2. Click **Message All**
3. Compose message
4. Choose delivery: Email, SMS, In-app
5. Send

**Filter & Message:**
- Message only "Going" status
- Message only approved registrations
- Message waitlist separately

---

## Attendance Tracking

### Setting Up Attendance

**Enable Attendance Tracking:**
1. Edit event
2. Scroll to **Attendance Settings**
3. Enable: **Track Attendance**
4. Options:
   - QR Code Check-in: Yes/No
   - Manual Check-in: Yes/No
   - Check-out Required: Yes/No
   - Late Cutoff Time: (e.g., 10 minutes after start)

### QR Code Check-In

**Setting Up QR Check-In:**

1. **Generate Event QR Code:**
   - Open event
   - Go to **Attendance** tab
   - Click **Generate Check-In QR**
   - Print QR code poster

2. **Check-In Process:**
   - Attendee shows their personal QR code
   - Staff scans with app
   - Instant check-in recorded
   - Green confirmation shown

3. **Check-In Station Setup:**
   - Tablet or phone with camera
   - Printed event QR code (backup)
   - Internet connection
   - Staff member assigned

**Benefits:**
- Fast check-in (2-3 seconds per person)
- Accurate timestamp recording
- No manual data entry
- Real-time attendance dashboard

### Manual Attendance Marking

**During Event:**

1. Go to event **Attendance** tab
2. See list of all registered users
3. For each attendee:
   - Click name
   - Mark as: Present, Absent, Late, Excused
   - Add notes if needed
4. Changes save automatically

**Bulk Actions:**
- Select multiple names
- Mark all as Present (for punctual arrivals)
- Mark all as Absent (for no-shows)

### Late Arrivals

**Handling Latecomers:**

1. Check-in after start time
2. System auto-marks as "Late"
3. You can:
   - Keep as Late
   - Change to Present (if acceptable)
   - Add note explaining lateness

**Late Cutoff:**
- Set in attendance settings
- Example: 10 minutes after start = Late
- After cutoff = Absent (optional)

### Real-Time Attendance Dashboard

**During Event View:**
- Total Registered: 200
- Checked In: 185
- Late: 10
- No Show: 5
- Attendance Rate: 97.5%

**Live Updates:**
- Updates every 5 seconds
- See check-ins in real-time
- Identify no-shows quickly
- Track entry flow rate

### Post-Event Attendance Reports

**Generate Reports:**

1. After event completion
2. Go to **Attendance** → **Reports**
3. Available reports:
   - **Summary Report**: Overall statistics
   - **Detailed List**: Individual attendance
   - **No-Show Report**: Users who didn't attend
   - **Late Arrivals**: Users who came late
   - **Duration Report**: Time spent (if check-out enabled)

**Export Options:**
- PDF (printable)
- Excel (data analysis)
- CSV (import to other systems)

---

## Analytics & Reporting

### Events Dashboard

Access: **Events** → **Analytics**

**Key Metrics:**

**Overview Cards:**
- Total Events (this month)
- Total Registrations
- Average Attendance Rate
- Most Popular Event Type

**Graphs & Charts:**
1. **Events Over Time**
   - Line chart showing event frequency
   - Filter by month, quarter, year

2. **Event Types Distribution**
   - Pie chart of event types
   - Helps in planning mix

3. **Registration Trends**
   - Registrations over time
   - Peak registration periods

4. **Attendance Rates**
   - Bar chart by event
   - Identify events with low attendance

### Event Performance Metrics

**For Each Event:**

| Metric | Formula | Good Target |
|--------|---------|-------------|
| Registration Rate | (Registered / Capacity) × 100 | > 70% |
| Attendance Rate | (Attended / Registered) × 100 | > 85% |
| No-Show Rate | (No-Shows / Registered) × 100 | < 10% |
| Waitlist Rate | (Waitlist / Capacity) × 100 | Varies |
| Early Registration | Registered 7+ days before | > 50% |

**Using Metrics:**
- Compare events of same type
- Identify successful formats
- Spot problematic events
- Guide future planning

### Comparative Analytics

**Compare Events:**
1. Select multiple events
2. Click **Compare**
3. See side-by-side:
   - Registration numbers
   - Attendance rates
   - User demographics
   - Time to fill capacity

**Year-over-Year:**
- Compare "Sports Day 2025" vs "Sports Day 2026"
- Track improvement/decline
- Justify resource allocation

### User Engagement Reports

**Top Participants:**
- Users with most event registrations
- Users with best attendance rate
- Users with most no-shows (for intervention)

**Grade/Role Analysis:**
- Which grades attend most events?
- Which roles engage more?
- Demographic trends

### Export Analytics

**For Presentations:**
1. Go to **Analytics**
2. Click **Export Report**
3. Choose format:
   - PowerPoint (with charts)
   - PDF (report format)
   - Excel (raw data)
4. Select date range
5. Download

---

## Category Management

### Understanding Categories

Categories help organize events:
- Better filtering
- Color-coding on calendar
- Easier searching
- Analytics grouping

### System Categories

**Pre-configured:**
- Academic Events
- Sports & Athletics
- Cultural Activities
- Parent Engagement
- Examinations
- Holidays & Breaks
- Administrative
- Student Activities

### Creating Custom Categories

1. Go to **Events** → **Settings** → **Categories**
2. Click **Add Category**
3. Fill details:
   ```
   Name: STEM Competitions
   Description: Science, Technology, Engineering, Math competitions
   Color: #4A90E2 (blue)
   Icon: 🔬 (microscope emoji)
   Active: Yes
   ```
4. Save category

### Category Best Practices

**Naming:**
- Clear and descriptive
- Consistent terminology
- Not too many categories (aim for 8-12)

**Color Coding:**
- Use distinct colors
- Consider color-blind friendly palettes
- Match school branding if possible

**Icons:**
- Use relevant emojis or icon set
- Helps quick visual identification
- Keep consistent style

---

## Recurring Events

### Creating Recurring Events

**Use Cases:**
- Weekly assemblies
- Monthly parent meetings
- Quarterly exams
- Annual celebrations

**Setup Steps:**

1. Create base event with all details
2. Enable **Recurring Event**
3. Set recurrence pattern:

   **Daily:**
   - Every day
   - Every weekday (Mon-Fri)
   - Every N days

   **Weekly:**
   - Select days: Mon, Wed, Fri
   - Every N weeks

   **Monthly:**
   - Same date each month (15th)
   - Same weekday (First Monday)
   - Every N months

   **Yearly:**
   - Same date annually
   - Custom (e.g., "Last Friday of June")

4. Set end condition:
   - End date
   - Number of occurrences
   - Never (ongoing)

5. Preview generated events
6. Publish series

### Managing Recurring Events

**Edit Series:**
- Changes apply to all future occurrences
- Past events remain unchanged
- Option to update past events

**Edit Single Occurrence:**
- Change only one event in series
- Creates exception in pattern
- Marked as "Modified from series"

**Cancel Series:**
- Cancel all future occurrences
- Option to keep certain dates
- Registrants notified

**Skip Occurrences:**
- Example: Skip during holiday break
- Add exception dates
- Events not created for those dates

### Recurring Event Best Practices

**Capacity:**
- Set realistic default capacity
- Can be adjusted per occurrence
- Monitor registration patterns

**Advance Notice:**
- Generate at least 2 months in advance
- Allows time for registration
- Helps long-term planning

**Review Regularly:**
- Check if pattern still makes sense
- Adjust based on attendance
- Retire unused recurring events

---

## Best Practices

### Event Planning

**Timeline:**

**6-8 Weeks Before:**
- [ ] Decide event concept
- [ ] Book venue/location
- [ ] Set date and time
- [ ] Determine capacity
- [ ] Create event in system (draft)

**4-6 Weeks Before:**
- [ ] Finalize event details
- [ ] Create promotional materials
- [ ] Upload featured image
- [ ] Set registration deadline
- [ ] Publish event

**2-4 Weeks Before:**
- [ ] Monitor registration numbers
- [ ] Send reminder to potential attendees
- [ ] Confirm venue and resources
- [ ] Assign staff roles

**1 Week Before:**
- [ ] Close registrations (if needed)
- [ ] Send event details to registrants
- [ ] Print attendance sheets / QR codes
- [ ] Final venue check
- [ ] Prepare check-in station

**Day Before:**
- [ ] Send 24-hour reminder
- [ ] Review attendee list
- [ ] Prepare materials
- [ ] Brief staff on roles

**Event Day:**
- [ ] Set up check-in station early
- [ ] Test QR scanning
- [ ] Monitor real-time attendance
- [ ] Handle late registrations
- [ ] Document event (photos/notes)

**After Event:**
- [ ] Mark event as completed
- [ ] Generate attendance report
- [ ] Send thank-you message
- [ ] Collect feedback
- [ ] Archive event materials
- [ ] Review analytics for insights

### Communication Strategy

**Pre-Event:**
- Announcement: At publication
- Early reminder: 2 weeks before
- Final reminder: 24 hours before
- Urgent reminder: 1 hour before

**During Event:**
- Live updates (for major events)
- Social media posts
- Real-time announcements

**Post-Event:**
- Thank you message
- Photo gallery
- Highlights/summary
- Follow-up surveys

### Capacity Planning

**Factors to Consider:**
- Venue size (physical constraints)
- Staff availability (for supervision)
- Resources (equipment, materials)
- Safety regulations (max occupancy)
- Historical attendance (from similar events)

**Setting Capacity:**
```
Venue Capacity: 300
Staff Ratio: 1:30 = 10 staff needed
Resources: 250 chairs available
Safety Limit: 280 per fire code

Recommended Capacity: 250 (safe, resourced)
```

**Oversubscription Strategy:**
- Set capacity at 80% of venue max
- Allows for walk-ins
- Accounts for no-shows
- Maintains comfort level

### Engagement Strategies

**Increase Registrations:**
- Eye-catching featured image
- Compelling description
- Early bird benefits
- Social proof (show registration count)
- Celebrity/special guest appearance
- Exclusive content/materials

**Reduce No-Shows:**
- Send multiple reminders
- Ask for confirmation closer to date
- Make check-in easy (QR codes)
- Incentivize attendance
- Follow up with no-shows
- Waitlist pressure (others waiting)

**Collect Feedback:**
- Post-event survey (within 24 hours)
- Rating system (5 stars)
- Testimonials for promotion
- Improvement suggestions
- Net Promoter Score

---

## Troubleshooting

### Common Issues & Solutions

**Issue: Low Registration Numbers**

Possible Causes:
- Event not visible (check publication status)
- Poor timing (conflicts with other events)
- Unclear description
- Target audience too narrow

Solutions:
- Extend registration deadline
- Improve event description
- Add featured image
- Send targeted reminders
- Adjust capacity if needed
- Promote via multiple channels

**Issue: High No-Show Rate**

Possible Causes:
- Too easy to register (low commitment)
- Event conflicts discovered later
- Weather/circumstances changed
- Lack of reminders

Solutions:
- Require approval for registration
- Send multiple reminders
- Ask for confirmation 24h before
- Implement no-show penalties (if appropriate)
- Make check-in easy and clear
- Follow up to understand reasons

**Issue: Capacity Filled Too Quickly**

Possible Causes:
- Capacity set too low
- High demand event
- Bots/mass registrations

Solutions:
- Enable waitlist
- Increase capacity if venue allows
- Create multiple sessions
- Implement registration limits
- Add registration deadline
- Require approval

**Issue: QR Check-In Not Working**

Possible Causes:
- Scanner app not configured
- Network connectivity issues
- QR code damaged/unclear
- Wrong event QR being used

Solutions:
- Restart scanner app
- Check internet connection
- Use manual check-in as backup
- Generate new QR codes
- Increase screen brightness
- Try different device

**Issue: Duplicate Registrations**

Possible Causes:
- User clicked register multiple times
- Technical glitch
- Family members registering same person

Solutions:
- Review registration list
- Delete duplicate entries
- Contact user to confirm
- Implement better UI (disable button after click)
- Add loading states

**Issue: Wrong Event Time Zone**

Possible Causes:
- System time zone mismatch
- User in different time zone
- Daylight saving time transition

Solutions:
- Always specify time zone in event details
- Use system default (school location)
- Show relative time ("in 2 hours")
- Allow time zone selection for virtual events
- Send reminders with explicit time zone

### Getting Help

**Support Channels:**

1. **Documentation:**
   - Full docs: docs.school.local
   - Video tutorials
   - FAQs

2. **Technical Support:**
   - Email: support@school.local
   - Phone: +1-555-123-4567
   - In-app chat

3. **Training:**
   - Admin training sessions
   - One-on-one coaching
   - Webinars

4. **Community:**
   - User forum
   - Best practices library
   - Case studies

---

## Appendix

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Create New Event | `Ctrl + N` |
| Search Events | `Ctrl + F` |
| Save Draft | `Ctrl + S` |
| Publish Event | `Ctrl + P` |
| Open Calendar | `Ctrl + K` |
| View Analytics | `Ctrl + A` |

### API Access

For integration with other systems:
- API Documentation: api-docs.school.local
- Get API Key: Settings → Integrations
- Rate Limits: 1000 requests/hour
- Support: api-support@school.local

### Permissions Matrix

| Action | Principal | Teacher | Admin Officer | Parent | Student |
|--------|-----------|---------|---------------|--------|---------|
| Create Event | ✅ | ✅ | Limited | ❌ | ❌ |
| Edit Own Event | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit Any Event | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Event | ✅ | Own Only | Own Only | ❌ | ❌ |
| Approve Registrations | ✅ | Own Events | Own Events | ❌ | ❌ |
| Mark Attendance | ✅ | ✅ | Limited | ❌ | ❌ |
| View Analytics | ✅ | Own Events | Limited | ❌ | ❌ |
| Export Data | ✅ | Own Events | Limited | ❌ | ❌ |
| Manage Categories | ✅ | ❌ | ❌ | ❌ | ❌ |

---

**Document Version:** 1.0.0  
**Last Updated:** July 15, 2026  
**Next Review:** January 2027

**Feedback:** Please send feedback and suggestions to docs@school.local
