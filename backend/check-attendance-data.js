/**
 * Check Attendance Data in Database
 */

import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function checkData() {
  try {
    console.log('📊 Checking attendance data...\n');

    // Get total count
    const count = await db('attendance').count('* as count').first();
    console.log(`Total attendance records: ${count.count}\n`);

    if (count.count === '0') {
      console.log('❌ No attendance records found in database!');
      console.log('   This means data is NOT being saved.\n');
      process.exit(0);
    }

    // Get recent records
    console.log('📋 Recent attendance records:');
    const recent = await db('attendance')
      .select(
        'id',
        'student_id',
        'class_id',
        'attendance_date',
        'status',
        'session_type',
        'check_in_time',
        'created_at'
      )
      .orderBy('created_at', 'desc')
      .limit(10);

    recent.forEach((r, i) => {
      console.log(`\n${i + 1}. Record ID: ${r.id}`);
      console.log(`   Student ID: ${r.student_id}`);
      console.log(`   Class ID: ${r.class_id || 'NULL'}`);
      console.log(`   Date: ${r.attendance_date}`);
      console.log(`   Status: ${r.status}`);
      console.log(`   Session: ${r.session_type}`);
      console.log(`   Check-in: ${r.check_in_time || 'N/A'}`);
      console.log(`   Created: ${r.created_at}`);
    });

    // Check for today's records
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n\n🔍 Today's attendance (${today}):`);
    const todayRecords = await db('attendance')
      .where('attendance_date', today)
      .select('*');

    if (todayRecords.length === 0) {
      console.log('   ❌ No records for today!');
    } else {
      console.log(`   ✅ Found ${todayRecords.length} records for today`);
      todayRecords.forEach((r, i) => {
        console.log(`\n   ${i + 1}. Student: ${r.student_id}`);
        console.log(`      Class: ${r.class_id || 'NULL'}`);
        console.log(`      Status: ${r.status}`);
        console.log(`      Session: ${r.session_type}`);
      });
    }

    // Check for JSS3 class records
    const jss3ClassId = '1b2eaad1-534b-4a6d-aee8-e474ffe2f817';
    console.log(`\n\n🎓 JSS3 Class Records (ID: ${jss3ClassId}):`);
    const jss3Records = await db('attendance')
      .where('class_id', jss3ClassId)
      .select('*');

    if (jss3Records.length === 0) {
      console.log('   ❌ No records found for JSS3!');
      console.log('   This is why the frontend shows empty!');
    } else {
      console.log(`   ✅ Found ${jss3Records.length} records for JSS3`);
      jss3Records.forEach((r, i) => {
        console.log(`\n   ${i + 1}. Date: ${r.attendance_date}`);
        console.log(`      Session: ${r.session_type}`);
        console.log(`      Student: ${r.student_id}`);
        console.log(`      Status: ${r.status}`);
      });
    }

    console.log('\n✅ Done!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

checkData();
