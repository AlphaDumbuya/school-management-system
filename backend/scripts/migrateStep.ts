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

async function getMigrations(): Promise<string[]> {
  const migrationsDir = path.resolve(__dirname, '../src/database/migrations');
  const fs = await import('fs');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.ts'))
    .sort();
  return files;
}

async function getCurrentMigrations(): Promise<string[]> {
  try {
    const migrations = await db('knex_migrations').select('name');
    return migrations.map(m => m.name);
  } catch (error) {
    return [];
  }
}

async function migrateOneStep() {
  try {
    console.log('Starting step-by-step migration...\n');

    const allMigrations = await getMigrations();
    const completedMigrations = await getCurrentMigrations();

    console.log(`Total migrations available: ${allMigrations.length}`);
    console.log(`Migrations completed: ${completedMigrations.length}\n`);

    const nextMigration = allMigrations.find(m => !completedMigrations.includes(m));

    if (!nextMigration) {
      console.log('✅ All migrations have been completed!');
      process.exit(0);
    }

    console.log(`Next migration to run: ${nextMigration}`);
    console.log('Running migration...\n');

    // Run just the next migration
    await db.migrate.latest();

    const newCompleted = await getCurrentMigrations();
    console.log(`\n✅ Successfully migrated to ${newCompleted.length} migrations`);
    console.log(`Completed migrations: ${newCompleted.join(', ')}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

migrateOneStep();
