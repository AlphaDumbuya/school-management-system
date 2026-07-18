# Debug Attendance Loading Issue

## Problem
- User marks attendance for JSS3
- Refreshes page
- Selects JSS3 again
- Students appear unmarked

## Quick Debug Steps

### Step 1: Check if data was saved
Open backend terminal and run:
```bash
cd backend
node -e "import('knex').then(k => { const knex = k.default(require('./knexfile.js').development); knex('attendance').select('*').orderBy('created_at', 'desc').limit(5).then(r => { console.log('Recent attendance:', JSON.stringify(r, null, 2)); process.exit(); }); });"
```

Expected: Should show recently marked attendance records

### Step 2: Open Browser DevTools
1. Open: http://localhost:5173/students/attendance
2. Press F12 (open DevTools)
3. Go to **Network** tab
4. Click "Class Register" tab
5. Select JSS3 class
6. Select today's date
7. Select "Morning Check-in"

### Step 3: Check API Calls
Look for these API calls in Network tab:

**A. GET /api/v1/classes/:id/students**
- Should return list of students in JSS3
- Status should be 200

**B. GET /api/v1/attendance/class/:classId?date=YYYY-MM-DD&session_type=morning**
- This loads existing attendance
- Status should be 200
- Check Response tab - should show attendance_records array

### Step 4: Inspect the Response
Click on the second API call (attendance/class/...) and check:

**Response should look like:**
```json
{
  "class_id": "uuid-here",
  "class_name": "JSS3",
  "attendance_records": [
    {
      "id": "uuid",
      "student_id": "uuid",
      "status": "present",
      "session_type": "morning",
      "check_in_time": "08:15:00",
      "date": "2026-07-18",
      "remarks": ""
    }
  ]
}
```

### Step 5: Check Console for Errors
In DevTools, go to **Console** tab and look for:
- Red errors
- Failed API calls
- "404 Not Found" or "500 Server Error"

---

## Common Issues & Fixes

### Issue A: API Returns Empty Array
**Symptom:** `attendance_records: []` even though data was saved

**Possible Causes:**
1. Wrong class_id being queried
2. Wrong date format
3. Wrong session_type
4. Data saved with NULL class_id but querying with specific class_id

**Fix:** Check backend query parameters

### Issue B: API Returns 404 or 500
**Symptom:** Network tab shows failed request

**Possible Causes:**
1. Backend not running
2. Route not found
3. Database error

**Fix:** Check backend terminal for errors

### Issue C: Data Loads But Doesn't Merge
**Symptom:** API returns data but UI doesn't show marked students

**Possible Causes:**
1. student_id mismatch (string vs UUID)
2. session_type mismatch
3. React state not updating

**Fix:** Check browser console for React errors

---

## Manual API Test

### Test if backend returns attendance:

1. Get a class ID:
```bash
# In backend terminal
node -e "import('knex').then(k => { const knex = k.default(require('./knexfile.js').development); knex('classes').select('id', 'name').limit(5).then(r => { console.log(r); process.exit(); }); });"
```

2. Test the API endpoint manually:
```bash
# Replace CLASS_ID and DATE
curl http://localhost:3000/api/v1/attendance/class/CLASS_ID?date=2026-07-18&session_type=morning
```

Expected: Should return attendance records

---

## Add Console Logging

Temporarily add logging to see what's happening:

### In AttendancePage.tsx, add after line 235:

```typescript
console.log('🔍 Debug Attendance Loading:');
console.log('  Class ID:', regClassId);
console.log('  Date:', regDate);
console.log('  Session:', regSession);
console.log('  Students:', currentStudents.length);
console.log('  Existing Records:', existingRecords.length);
console.log('  Existing Records Data:', existingRecords);
```

Then refresh and check browser console.

---

## Quick Fix Attempts

### Fix 1: Force Refetch
Change staleTime from 10_000 to 0 to force fresh data:

```typescript
const { data: existingAttData, isLoading: existingLoading } = useQuery({
  queryKey: ['reg-existing', regClassId, regDate, regSession, isAllStudentsMode],
  queryFn: () => {
    // ...
  },
  enabled: ((!!regClassId && !isAllStudentsMode) || isAllStudentsMode) && !!regDate && activeTab === 'register',
  staleTime: 0,  // Changed from 10_000
});
```

### Fix 2: Add Refetch on Mount
Add refetchOnMount option:

```typescript
const { data: existingAttData, isLoading: existingLoading } = useQuery({
  queryKey: ['reg-existing', regClassId, regDate, regSession, isAllStudentsMode],
  queryFn: () => {
    // ...
  },
  enabled: ((!!regClassId && !isAllStudentsMode) || isAllStudentsMode) && !!regDate && activeTab === 'register',
  staleTime: 10_000,
  refetchOnMount: 'always',  // Add this
});
```

### Fix 3: Check Query Key
The queryKey might not be updating correctly. Check if regClassId, regDate, regSession are actually changing.

---

## Expected Flow

### Correct Flow:
1. User selects JSS3, today's date, morning session
2. Frontend makes API call: GET /api/v1/attendance/class/JSS3_ID?date=2026-07-18&session_type=morning
3. Backend queries: `SELECT * FROM attendance WHERE class_id = JSS3_ID AND attendance_date = 2026-07-18 AND session_type = morning`
4. Returns attendance records
5. Frontend merges with student list
6. UI shows marked students

### Where It Might Be Failing:
- ❌ API not being called (check Network tab)
- ❌ API returning empty (check Response)
- ❌ Merge logic not working (check Console)
- ❌ React Query cache issue (try refetchOnMount)

---

## Report Findings

After completing the debug steps, provide:
1. Screenshot of Network tab showing API calls
2. Screenshot of Response for attendance API
3. Screenshot of Console showing any errors
4. Output of database query (Step 1)

This will help identify exactly where the issue is!
