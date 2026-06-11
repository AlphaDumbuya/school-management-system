import knex from 'knex';
import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'school_management_dev',
  },
});

async function resetDatabase() {
  try {
    console.log('Starting database reset...');

    // Drop all tables with CASCADE
    await db.raw(`
      DROP TABLE IF EXISTS external_service_integrations CASCADE;
      DROP TABLE IF EXISTS external_service_configs CASCADE;
      DROP TABLE IF EXISTS mobile_device_tracking CASCADE;
      DROP TABLE IF EXISTS performance_metrics CASCADE;
      DROP TABLE IF EXISTS help_articles CASCADE;
      DROP TABLE IF EXISTS help_categories CASCADE;
      DROP TABLE IF EXISTS security_headers_config CASCADE;
      DROP TABLE IF EXISTS privacy_settings CASCADE;
      DROP TABLE IF EXISTS audit_compliance_logs CASCADE;
      DROP TABLE IF EXISTS api_integrations CASCADE;
      DROP TABLE IF EXISTS import_errors CASCADE;
      DROP TABLE IF EXISTS export_jobs CASCADE;
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS student_imports CASCADE;
      DROP TABLE IF EXISTS enrollment_requests CASCADE;
      DROP TABLE IF EXISTS report_schedules CASCADE;
      DROP TABLE IF EXISTS reports CASCADE;
      DROP TABLE IF EXISTS grade_components CASCADE;
      DROP TABLE IF EXISTS grades CASCADE;
      DROP TABLE IF EXISTS attendance CASCADE;
      DROP TABLE IF EXISTS schedule_slots CASCADE;
      DROP TABLE IF EXISTS timetables CASCADE;
      DROP TABLE IF EXISTS dashboards CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS notification_preferences CASCADE;
      DROP TABLE IF EXISTS notification_triggers CASCADE;
      DROP TABLE IF EXISTS notification_configurations CASCADE;
      DROP TABLE IF EXISTS fees CASCADE;
      DROP TABLE IF EXISTS invoices CASCADE;
      DROP TABLE IF EXISTS payments CASCADE;
      DROP TABLE IF EXISTS fee_configurations CASCADE;
      DROP TABLE IF EXISTS enrollments CASCADE;
      DROP TABLE IF EXISTS class_subjects CASCADE;
      DROP TABLE IF EXISTS subjects CASCADE;
      DROP TABLE IF EXISTS classes CASCADE;
      DROP TABLE IF EXISTS students CASCADE;
      DROP TABLE IF EXISTS teachers CASCADE;
      DROP TABLE IF EXISTS academic_sessions CASCADE;
      DROP TABLE IF EXISTS role_permissions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    console.log('All tables dropped.');

    // Clear migration history
    await db.raw('DROP TABLE IF EXISTS knex_migrations CASCADE');
    await db.raw('DROP TABLE IF EXISTS knex_migrations_lock CASCADE');

    console.log('Migration history cleared.');

    console.log('Database reset complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

resetDatabase();
