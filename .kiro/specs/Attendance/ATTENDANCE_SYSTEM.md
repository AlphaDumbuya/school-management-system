# Enhanced Attendance System Documentation

## Overview
The attendance system has been upgraded to support **session-based attendance tracking** with **automatic time recording** for student arrivals and departures.

---

## ✨ Key Features

### 1. **Multiple Daily Sessions**
Each day can have multiple attendance sessions:
- **Morning Check-in** - Tracks when students arrive at school
- **Afternoon Check-out** - Tracks when students leave school
- **Full Day** - General day attendance without specific time tracking

### 2. **Automatic Time Tracking**
When marking attendance as "Present":
- **Morning session** → Automatically records `check_in_time`
- **Afternoon session** → Automatically records `check_out_time`
- **Full Day session** → Records `check_in_time` for reference

### 3. **Persistent Daily Records**
- Attendance is saved per student, per date, per session
- Teachers can refresh the page and data persists
- Each session (morning/afternoon) is tracked separately
- Unique constraint prevents duplicate entries for same student/date/session

### 4. **All Students Mode**
- View and mark attendance for ALL enrolled students across all classes
- Useful for school-wide events or general attendance tracking
- Shows student profile photos and IDs
- Displays student's class information

### 5. **Profile Photo Display**
- Shows actual student profile photos when available
- Falls back to colored initials if no photo exists
- Camera icon indicates when photo is loaded
- Photos are loaded from Unsplash (sample data)

---

## 📊 Database Schema

### New Columns Added to `attendance` Table
```sql
session_type VARCHAR(20) DEFAULT 'full_day'  -- 'morning', 'afternoon', 'full_day'
check_in_time TIME                            -- When student arrived (HH:MM)
check_out_time TIME                           -- When student left (HH:MM)
marked_at TIMESTAMP DEFAULT NOW()             -- When attendance was marked
```

### Unique Constraint
```sql
UNIQUE (student_id, attendance_date, session_type)
```
This prevents duplicate attendance entries for the same student on the same day in the same session.

---

## 🎯 How It Works

### For Teachers:

1. **Select Class, Date & Session**
   - Choose a specific class or "All Enrolled Students"
   - Pick the date (defaults to today)
   - Select session type (Morning/Afternoon/Full Day)

2. **Mark Attendance**
   - Click status buttons: P (Present), L (Late), A (Absent), E (Excused)
   - Changes auto-save immediately with timestamps
   - Times are automatically recorded based on session type

3. **View Time Information**
   - Each student card shows check-in/out times when marked present
   - Session badge displays at the top
   - Progress bar shows marking completion

4. **Persistence**
   - Attendance persists across page refreshes
   - Load any previous date to view/edit historical attendance
   - Each session maintains separate records

---

## 🔄 Daily Reset & Data Management

### How Daily Reset Works:
1. **Each day starts fresh** - No attendance is pre-marked
2. **Previous days remain saved** - Historical data is never lost
3. **Session independence** - Morning and afternoon sessions are separate
4. **Load any date** - Teachers can view/edit past attendance by selecting the date

### Data Storage:
```javascript
// Example: Student attendance on 2026-01-15
{
  // Morning Session
  {
    student_id: "STU-2026-00001",
    date: "2026-01-15",
    session_type: "morning",
    status: "present",
    check_in_time: "08:15"  // Arrived at 8:15 AM
  },
  
  // Afternoon Session  
  {
    student_id: "STU-2026-00001",
    date: "2026-01-15",
    session_type: "afternoon",
    status: "present",
    check_out_time: "15:30"  // Left at 3:30 PM
  }
}
```

---

## 📱 UI Features

### Modern Card-Based Layout
- **Grid View** - Students displayed in cards (like Google Meet/Zoom)
- **Profile Photos** - Shows student photos with fallback to initials
- **Color-Coded Status** - Cards change color based on attendance status
- **Real-Time Updates** - Auto-save with visual feedback

### Session Information Panel
- Shows current session type with colored badge
- Displays session description and time tracking info
- Auto-updates based on selected session

### Status Indicators
- ✅ **Green** - Present
- 🟡 **Amber** - Late
- 🔴 **Red** - Absent
- 🔵 **Blue** - Excused
- ⚪ **Gray** - Unmarked

### Time Display
```
Status: Present
In: 08:15
```
or
```
Status: Present
Out: 15:30
```

---

## 🔧 API Endpoints Updated

### POST `/api/v1/attendance/bulk`
**New Fields:**
- `session_type` - 'morning', 'afternoon', or 'full_day'
- `check_in_time` - HH:MM format (optional)
- `check_out_time` - HH:MM format (optional)

**Example Request:**
```json
{
  "class_id": "uuid-here",
  "date": "2026-01-15",
  "session_type": "morning",
  "records": [
    {
      "student_id": "uuid-1",
      "status": "present",
      "check_in_time": "08:15",
      "remarks": "On time"
    }
  ]
}
```

### GET `/api/v1/attendance`
**New Query Parameters:**
- `session_type` - Filter by session type

### GET `/api/v1/attendance/class/:classId`
**New Query Parameters:**
- `session_type` - Filter by session type

---

## 💡 Use Cases

### Morning Check-In
1. Teacher selects "Morning Check-in" session
2. Marks students as they arrive
3. System automatically records arrival time
4. Late students can be marked with "Late" status

### Afternoon Check-Out
1. Teacher selects "Afternoon Check-out" session  
2. Marks students as they leave
3. System automatically records departure time
4. Tracks which students left early

### School-Wide Attendance
1. Select "All Enrolled Students"
2. Mark attendance across all classes
3. Useful for events, assemblies, or emergency situations

---

## 🎨 Visual Design

- **Cybersecurity Aesthetic** - Modern, clean design with cyan accents
- **Dark Mode Support** - Full dark theme compatibility
- **Responsive** - Works on all screen sizes (mobile, tablet, desktop)
- **Accessibility** - High contrast colors and clear visual indicators

---

## 📝 Sample Photos Script

Run this script to add sample photos to existing students:
```bash
cd backend
node update-student-photos.js
```

This updates all students with high-quality profile photos from Unsplash.

---

## 🚀 Migration

The database migration `035_enhance_attendance_system.ts` has been applied. It:
- Adds `session_type`, `check_in_time`, `check_out_time`, `marked_at` columns
- Creates unique constraint on (student_id, attendance_date, session_type)
- Sets default values for backward compatibility

---

## 📊 Reporting Benefits

With session-based tracking, you can now:
- Track student punctuality (late arrivals)
- Monitor early departures
- Generate time-based attendance reports
- Identify attendance patterns by time of day
- Track average arrival/departure times

---

## 🔐 Security

- Only teachers and principals can mark attendance
- Timestamps are automatically generated (cannot be manipulated)
- Audit trail via `marked_by` and `marked_at` fields
- Session-based constraints prevent duplicate entries

---

## 🎯 Future Enhancements

Potential additions:
- Automated late notifications
- Parent SMS alerts for absences
- Geolocation-based check-in (mobile app)
- Barcode/QR code student scanning
- Integration with door access systems
- Automated attendance reports

---

**Status:** ✅ Fully Implemented
**Version:** 1.0.0
**Last Updated:** January 2026
