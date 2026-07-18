import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function testGetQuery() {
  try {
    console.log('🧪 Testing GET attendance query on database...');
    
    let query = db('attendance')
      .leftJoin('students', 'attendance.student_id', 'students.id')
      .leftJoin('classes', 'attendance.class_id', 'classes.id');

    console.log('1. Testing count query...');
    const totalResult = await query.clone().count('attendance.id as count').first();
    console.log('   ✅ Count query success, total:', totalResult);

    console.log('2. Testing select query...');
    const records = await query
      .select(
        'attendance.id',
        'attendance.student_id',
        'attendance.class_id',
        'attendance.attendance_date as date',
        'attendance.status',
        'attendance.session_type',
        'attendance.check_in_time',
        'attendance.check_out_time',
        'attendance.marked_at',
        'attendance.remarks',
        'attendance.created_at',
        db.raw("students.first_name || ' ' || students.last_name as student_name"),
        'students.student_id as student_id_code',
        'classes.name as class_name'
      )
      .limit(20)
      .offset(0)
      .orderBy('attendance.attendance_date', 'desc')
      .orderBy('attendance.session_type', 'asc')
      .orderBy('students.first_name', 'asc');

    console.log('   ✅ Select query success, records count:', records.length);
    if (records.length > 0) {
      console.log('   📋 Sample record:', JSON.stringify(records[0], null, 2));
    } else {
      console.log('   ⚠️ No records found in the database. Please make sure attendance is marked.');
    }
    console.log('   ✅ Done!');
  } catch (error) {
    console.error('   ❌ Query failed:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

testGetQuery();
