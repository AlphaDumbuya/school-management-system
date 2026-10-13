import type { Knex } from 'knex';

/**
 * School audit log: make every audit row belong to a school.
 *
 * audit_logs had no tenant column, so a row could only be tied to a school
 * through whoever acted (and not at all once that user was removed). This adds:
 *   - tenant_id   the school the action belongs to (no foreign key on purpose, so
 *                 removing a school or user never blocks or rewrites history)
 *   - actor_name  the actor's name at the time (survives renames and removals)
 *
 * A BEFORE INSERT trigger fills tenant_id, actor_name and the actor's role for
 * EVERY writer (the ~10 existing code paths and any future one), so no caller
 * has to change. The trigger can never block a write: any error inside it is
 * swallowed and the row is stored as given.
 *
 * Platform staff (super admins) act across schools: their rows belong to the
 * school named in the row (changes.tenant_id / new_values.tenantId) and to no
 * school otherwise.
 *
 * Existing rows are backfilled the same way. Only the new columns are written;
 * no existing value is changed except filling a missing actor role.
 */
const UUID_RE = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('audit_logs'))) return;

  if (!(await knex.schema.hasColumn('audit_logs', 'tenant_id'))) {
    await knex.schema.alterTable('audit_logs', (t) => {
      t.uuid('tenant_id').nullable();
    });
  }
  if (!(await knex.schema.hasColumn('audit_logs', 'actor_name'))) {
    await knex.schema.alterTable('audit_logs', (t) => {
      t.string('actor_name', 200).nullable();
    });
  }

  await knex.raw(`
    CREATE OR REPLACE FUNCTION audit_logs_fill_context() RETURNS trigger AS $fn$
    DECLARE
      actor_id uuid;
      a_tenant uuid;
      a_role text;
      a_name text;
      target text;
    BEGIN
      BEGIN
        actor_id := COALESCE(NEW.performed_by, NEW.user_id);
        IF actor_id IS NOT NULL THEN
          SELECT u.tenant_id, u.role,
                 COALESCE(NULLIF(btrim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.email)
            INTO a_tenant, a_role, a_name
            FROM users u WHERE u.id = actor_id;
          IF NEW.actor_name IS NULL THEN NEW.actor_name := a_name; END IF;
          IF NEW.performed_by_role IS NULL THEN NEW.performed_by_role := a_role; END IF;
        END IF;

        IF NEW.tenant_id IS NULL THEN
          target := NEW.changes ->> 'tenant_id';
          IF target IS NULL OR target !~* '${UUID_RE}' THEN
            target := NEW.new_values ->> 'tenantId';
          END IF;
          IF target IS NOT NULL AND target ~* '${UUID_RE}' THEN
            NEW.tenant_id := target::uuid;
          ELSIF a_role IS DISTINCT FROM 'super_admin' THEN
            NEW.tenant_id := a_tenant;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- never block the audit write itself
      END;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql
  `);

  await knex.raw('DROP TRIGGER IF EXISTS audit_logs_fill_context_trg ON audit_logs');
  await knex.raw(`
    CREATE TRIGGER audit_logs_fill_context_trg
    BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_fill_context()
  `);

  // Backfill existing rows the same way (only rows that have no school yet).
  await knex.raw(`
    UPDATE audit_logs a SET
      tenant_id = COALESCE(
        CASE WHEN a.changes ->> 'tenant_id' ~* '${UUID_RE}' THEN (a.changes ->> 'tenant_id')::uuid END,
        CASE WHEN a.new_values ->> 'tenantId' ~* '${UUID_RE}' THEN (a.new_values ->> 'tenantId')::uuid END,
        CASE WHEN u.role IS DISTINCT FROM 'super_admin' THEN u.tenant_id END
      ),
      actor_name = COALESCE(
        a.actor_name,
        NULLIF(btrim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
        u.email
      ),
      performed_by_role = COALESCE(a.performed_by_role, u.role)
    FROM users u
    WHERE u.id = COALESCE(a.performed_by, a.user_id)
      AND a.tenant_id IS NULL
  `);

  await knex.raw('CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx ON audit_logs (tenant_id, created_at DESC)');
  await knex.raw('CREATE INDEX IF NOT EXISTS audit_logs_tenant_entity_idx ON audit_logs (tenant_id, entity_type)');
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('audit_logs'))) return;
  await knex.raw('DROP TRIGGER IF EXISTS audit_logs_fill_context_trg ON audit_logs');
  await knex.raw('DROP FUNCTION IF EXISTS audit_logs_fill_context()');
  await knex.raw('DROP INDEX IF EXISTS audit_logs_tenant_created_idx');
  await knex.raw('DROP INDEX IF EXISTS audit_logs_tenant_entity_idx');
  if (await knex.schema.hasColumn('audit_logs', 'actor_name')) {
    await knex.schema.alterTable('audit_logs', (t) => t.dropColumn('actor_name'));
  }
  if (await knex.schema.hasColumn('audit_logs', 'tenant_id')) {
    await knex.schema.alterTable('audit_logs', (t) => t.dropColumn('tenant_id'));
  }
}
