/**
 * Verify Attendance Schema
 * Quick check to ensure session-based attendance fields exist
 */

import knex from 'knex';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

async function verifySchema() {
  console.log('🔍 Verifying attendance table schema...\n');

  try {
    // Check if table exists
    const hasTable = await db.schema.hasTable('attendance');
    if (!hasTable) {
      console.error('❌ Attendance table does not exist!');
      process.exit(1);
    }
    console.log('✅ Attendance table exists');

    // Check for required columns
    const requiredColumns = [
      'session_type',
      'check_in_time',
      'check_out_time',
      'marked_at',
    ];

    for (const column of requiredColumns) {
      const hasColumn = await db.schema.hasColumn('attendance', column);
      if (hasColumn) {
        console.log(`✅ Column '${column}' exists`);
      } else {
        console.error(`❌ Column '${column}' is MISSING!`);
        console.error('   → Run: npm run db:migrate');
        process.exit(1);
      }
    }

    // Get column information
    console.log('\n📊 Column Details:');
    const columnInfo = await db('attendance').columnInfo();
    
    if (columnInfo.session_type) {
      console.log(`   session_type: ${columnInfo.session_type.type} (default: ${columnInfo.session_type.defaultValue})`);
    }
    if (columnInfo.check_in_time) {
      console.log(`   check_in_time: ${columnInfo.check_in_time.type} (nullable: ${columnInfo.check_in_time.nullable})`);
    }
    if (columnInfo.check_out_time) {
      console.log(`   check_out_time: ${columnInfo.check_out_time.type} (nullable: ${columnInfo.check_out_time.nullable})`);
    }
    if (columnInfo.marked_at) {
      console.log(`   marked_at: ${columnInfo.marked_at.type} (nullable: ${columnInfo.marked_at.nullable})`);
    }

    // Check for sample data
    console.log('\n📈 Sample Data Check:');
    const count = await db('attendance').count('* as count').first();
    console.log(`   Total attendance records: ${count.count}`);

    const sessionsCount = await db('attendance')
      .select('session_type')
      .count('* as count')
      .groupBy('session_type');
    
    if (sessionsCount.length > 0) {
      console.log('   Records by session:');
      sessionsCount.forEach((row) => {
        console.log(`      ${row.session_type}: ${row.count}`);
      });
    } else {
      console.log('   No attendance records yet (expected for new system)');
    }

    // Check for today's attendance
    const today = new Date().toISOString().split('T')[0];
    const todayCount = await db('attendance')
      .where('attendance_date', today)
      .count('* as count')
      .first();
    
    console.log(`   Today's attendance records: ${todayCount.count}`);

    // Check for unique constraint
    console.log('\n🔒 Constraint Check:');
    const duplicates = await db('attendance')
      .select('student_id', 'attendance_date', 'session_type')
      .count('* as count')
      .groupBy('student_id', 'attendance_date', 'session_type')
      .having(db.raw('COUNT(*) > 1'));

    if (duplicates.length > 0) {
      console.warn(`⚠️  Found ${duplicates.length} duplicate records (unique constraint may not be working)`);
      duplicates.forEach((dup) => {
        console.warn(`   Student ${dup.student_id} on ${dup.attendance_date} (${dup.session_type}): ${dup.count} records`);
      });
    } else {
      console.log('✅ No duplicate records (unique constraint working)');
    }

    console.log('\n🎉 Schema verification complete!\n');
    console.log('Next steps:');
    console.log('  1. Start the backend: npm run dev');
    console.log('  2. Start the frontend: cd ../frontend && npm run dev');
    console.log('  3. Open http://localhost:5173/students/attendance');
    console.log('  4. Follow ATTENDANCE_TEST_PLAN.md for testing\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

verifySchema();
