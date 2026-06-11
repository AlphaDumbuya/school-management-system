# Database Reset Commands for Neon PostgreSQL

## COMPLETE DATABASE RESET

Run these SQL commands in your Neon SQL Editor to completely reset the database before running migrations.

### Step 1: Drop ALL Tables and Functions
Copy and paste this entire block into your Neon SQL Editor and execute it:

```sql
-- Drop all tables and functions to completely reset the database
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Reset sequences
SELECT setval(pg_get_serial_sequence(t.tablename, c.attname), 1)
FROM pg_tables t
JOIN pg_attribute c ON c.attrelid = (t.tablename)::regclass
WHERE t.schemaname = 'public'
AND c.attnum > 0
AND NOT c.attisdropped;
```

### Step 2: Verify Tables Are Deleted
Run this query to verify all tables have been dropped:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

**Expected Result**: Empty result set (no tables should be listed)

### Step 3: After Reset is Complete
Once you see an empty result, proceed to run the migrations:

```bash
cd backend
npm run db:migrate
npm run db:seed
```

---

## Why Tables Persisted

The Neon dashboard shows all tables because:
1. The reset scripts may not have been complete
2. Schema recreation might have issues
3. Foreign key constraints can prevent full deletion

The SQL above uses `CASCADE` to drop everything including dependent objects.

---

## Alternative: Using knex CLI Reset Script

If you prefer, you can also use knex's built-in reset functionality. Add this to `backend/package.json` scripts if not already there:

```json
"db:reset": "knex migrate:rollback --all && knex migrate:latest && knex seed:run"
```

Then run:
```bash
cd backend
npm run db:reset
```

However, the SQL commands above are more reliable for Neon.

---

## After Complete Reset

Once the database is empty:
1. Run `npm run db:migrate` to create the schema
2. Run `npm run db:seed` to populate initial data
3. Login with: `admin@school.com` / `password123`

