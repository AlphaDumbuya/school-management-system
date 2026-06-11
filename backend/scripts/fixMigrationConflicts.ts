/**
 * Script to systematically fix remaining migration conflicts
 * This identifies all createTable calls that should be createTableIfNotExists
 */

const migrationsToFix = [
  {
    file: '003_phase5_grades.ts',
    tables: ['grades'],
  },
  {
    file: '008_phase10_dashboard_config.ts',
    tables: ['dashboards'],
  },
  {
    file: '009_phase14_import_export.ts',
    tables: ['export_jobs'],
  },
  {
    file: '010_phase15_configuration.ts',
    tables: ['academic_sessions', 'grading_scales'],
  },
];

console.log('Migrations with duplicate tables to fix:');
migrationsToFix.forEach(m => {
  console.log(`- ${m.file}: ${m.tables.join(', ')}`);
});
