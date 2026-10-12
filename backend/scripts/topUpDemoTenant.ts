/**
 * Adds what the demo school is missing, without touching what is there:
 * profile pictures, the exam timetable, help-desk tickets and a bank statement.
 * Only inserts rows and fills empty/demo photo fields on the demo tenant; it
 * deletes nothing and will not run against any other school.
 *
 *   npm run demo:topup
 */
import { db } from '../src/utils/database';
import { DEMO_TENANT_SLUG } from '../src/utils/demo';
import { applyDemoExtras } from './lib/demoExtras';

async function main() {
  const t = await db('tenants').where({ slug: DEMO_TENANT_SLUG }).first('id');
  if (!t) throw new Error('There is no demo school yet. Run the demo seed first.');
  console.log('Topping up the demo school…');
  await applyDemoExtras(t.id);
  console.log('Done.');
}

main()
  .then(() => db.destroy())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error('Top-up failed:', e?.message || e);
    await db.destroy().catch(() => undefined);
    process.exit(1);
  });
