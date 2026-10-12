/**
 * Test Attendance Save Functionality
 * This script tests if attendance can be saved to the database
 */

import knex from 'knex';
import knexConfig from './knexfile.js';

// SAFETY: this script writes test data. Run it only against a local database,
// or a remote one with the exact override ALLOW_DESTRUCTIVE_DB=<host>/<database>.
{
  let host = '';
  let name = '';
  try { const u = new URL(process.env.DATABASE_URL || ''); host = u.hostname.toLowerCase(); name = u.pathname.replace(/^\//, ''); } catch { /* none */ }
  const local = !process.env.DATABASE_URL || ['localhost', '127.0.0.1', '::1'].includes(host) || !host.includes('.');
  if (!local && process.env.ALLOW_DESTRUCTIVE_DB !== `${host}/${name}`) {
    console.error(`BLOCKED: this script writes test data and the database is REMOTE (${host}/${name}). Use a local database, or set ALLOW_DESTRUCTIVE_DB=${host}/${name} if you really mean it.`);
    process.exit(1);
  }
}


const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function testAttendanceSave() {
  console.log('🧪 Testing Attendance Save Functionality\n');

  try {
    // Step 1: Check if attendance table exists
    console.log('1. Checking attendance table...');
    const hasTable = await db.schema.hasTable('attendance');
    if (!hasTable) {
      console.error('   ❌ Attendance table does not exist!');
      process.exit(1);
    }
    console.log('   ✅ Attendance table exists\n');

    // Step 2: Get a test student
    console.log('2. Finding a test student...');
    const student = await db('students')
      .select('id', 'student_id', 'first_name', 'last_name')
      .where('status', 'active')
      .first();
    
    if (!student) {
      console.error('   ❌ No active students found!');
      console.log('   💡 Please add some students first');
      process.exit(1);
    }
    console.log(`   ✅ Found student: ${student.first_name} ${student.last_name} (${student.student_id})\n`);

    // Step 3: Get a test user (teacher) for marked_by
    console.log('3. Finding a test teacher/principal...');
    const teacher = await db('users')
      .select('id', 'email', 'role')
      .whereIn('role', ['teacher', 'principal'])
      .first();
    
    if (!teacher) {
      console.error('   ❌ No teacher or principal found!');
      console.log('   💡 Please add a teacher or principal user first');
      process.exit(1);
    }
    console.log(`   ✅ Found user: ${teacher.email} (${teacher.role})\n`);

    // Step 4: Check if test record already exists
    const today = new Date().toISOString().split('T')[0];
    const testSession = 'morning';
    
    console.log('4. Checking for existing test record...');
    const existing = await db('attendance')
      .where('student_id', student.id)
      .where('attendance_date', today)
      .where('session_type', testSession)
      .first();
    
    if (existing) {
      console.log('   ℹ️  Test record already exists, deleting it first...');
      await db('attendance').where('id', existing.id).del();
      console.log('   ✅ Old test record deleted\n');
    } else {
      console.log('   ✅ No existing test record\n');
    }

    // Step 5: Insert a test attendance record
    console.log('5. Inserting test attendance record...');
    const testRecord = {
      student_id: student.id,
      attendance_date: today,
      status: 'present',
      session_type: testSession,
      check_in_time: '08:15:00',
      remarks: 'Test record from diagnostic script',
      marked_by: teacher.id,
      marked_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [insertedId] = await db('attendance')
      .insert(testRecord)
      .returning('id');
    
    const actualId = typeof insertedId === 'object' ? insertedId.id : insertedId;
    console.log(`   ✅ Record inserted with ID: ${actualId}\n`);

    // Step 6: Verify the record was saved
    console.log('6. Verifying record was saved...');
    const saved = await db('attendance')
      .where('id', actualId)
      .first();
    
    if (!saved) {
      console.error('   ❌ Record not found after insert!');
      process.exit(1);
    }
    
    console.log('   ✅ Record verified:');
    console.log('      Student ID:', saved.student_id);
    console.log('      Date:', saved.attendance_date);
    console.log('      Status:', saved.status);
    console.log('      Session:', saved.session_type);
    console.log('      Check-in Time:', saved.check_in_time);
    console.log('      Remarks:', saved.remarks);
    console.log('      Marked By:', saved.marked_by);
    console.log('');

    // Step 7: Test querying the record (like the frontend does)
    console.log('7. Testing query (like frontend does)...');
    const queried = await db('attendance')
      .leftJoin('students', 'attendance.student_id', 'students.id')
      .select(
        'attendance.id',
        'attendance.student_id',
        'attendance.attendance_date as date',
        'attendance.status',
        'attendance.session_type',
        'attendance.check_in_time',
        'attendance.remarks',
        db.raw("students.first_name || ' ' || students.last_name as student_name"),
        'students.student_id as student_id_code'
      )
      .where('attendance.id', actualId)
      .first();
    
    if (!queried) {
      console.error('   ❌ Record not found in joined query!');
      process.exit(1);
    }
    
    console.log('   ✅ Query successful:');
    console.log('      Student Name:', queried.student_name);
    console.log('      Student ID Code:', queried.student_id_code);
    console.log('      Date:', queried.date);
    console.log('      Status:', queried.status);
    console.log('      Session:', queried.session_type);
    console.log('');

    // Step 8: Test updating the record
    console.log('8. Testing update (like when editing)...');
    await db('attendance')
      .where('id', actualId)
      .update({
        status: 'late',
        check_in_time: '08:45:00',
        remarks: 'Updated via diagnostic script',
        updated_at: new Date(),
      });
    
    const updated = await db('attendance').where('id', actualId).first();
    console.log('   ✅ Update successful:');
    console.log('      New Status:', updated.status);
    console.log('      New Check-in:', updated.check_in_time);
    console.log('      New Remarks:', updated.remarks);
    console.log('');

    // Step 9: Clean up (delete test record)
    console.log('9. Cleaning up test record...');
    await db('attendance').where('id', actualId).del();
    
    const stillExists = await db('attendance').where('id', actualId).first();
    if (stillExists) {
      console.error('   ❌ Failed to delete test record!');
    } else {
      console.log('   ✅ Test record deleted\n');
    }

    // Step 10: Count total attendance records
    console.log('10. Checking total attendance records...');
    const count = await db('attendance').count('* as count').first();
    console.log(`    📊 Total attendance records: ${count.count}\n`);

    console.log('✅ ALL TESTS PASSED!\n');
    console.log('📌 The database can save and retrieve attendance records.');
    console.log('📌 If frontend is still not saving, check:');
    console.log('   1. Browser console for errors');
    console.log('   2. Network tab to see if API calls are being made');
    console.log('   3. Backend API routes are responding correctly');
    console.log('   4. User is authenticated with valid token\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

testAttendanceSave();
