# Data Backups

WiSkul relies on two complementary layers of backup: the managed database's
automated backups (platform-wide durability) and on-demand per-tenant exports
(portable snapshots a school or the platform team can keep offline).

## 1. Database backups (platform-wide)

The application database is hosted on **Neon (Postgres)**, which provides
automated continuous backups and point-in-time recovery (PITR):

- **Automated backups & history retention** are managed by Neon. Retention
  depends on the Neon plan (typically 7 days on paid tiers; check the current
  plan in the Neon console).
- **Point-in-time recovery**: Neon can restore the branch to any moment within
  the retention window.

### Restore runbook (full database)

1. Open the Neon console → the WiSkul project → **Branches / Restore**.
2. Choose **Restore** and pick the target timestamp (PITR) or a specific backup.
3. Neon creates a restored branch. Verify data on that branch first.
4. Update `DATABASE_URL` (and `.env` / Vercel env) to point at the restored
   branch, or promote it, then redeploy.
5. Confirm the app boots and key data (tenants, students, finance) is intact.

> Because the platform is multi-tenant on a single database, a full DB restore
> affects ALL tenants. For single-tenant recovery prefer the on-demand tenant
> backup below plus targeted re-import.

## 2. On-demand tenant backup (per school)

A super admin can download a complete snapshot of one tenant's data as a single
**multi-sheet XLSX workbook** (one sheet per table). This needs no extra tooling
and is easy to inspect or archive.

- **Where**: Super Admin → Platform → Tenants → open a tenant → **Backup**.
- **API**: `GET /api/v1/platform/tenants/:id/backup` (super-admin only).
- **Contents**: a `Backup Info` cover sheet (tenant, timestamp, per-table row
  counts) plus one sheet per table: schools, academic_sessions, classes,
  subjects, students, users, teachers, admission_applications, enrollments,
  attendance, grades, invoices, payments, fees.
- **Tenant isolation**: every sheet is filtered by `tenant_id` (directly, or via
  the tenant's own students/classes for child tables), so a backup can never
  contain another tenant's data.

### Scheduling

The on-demand backup is manual by design (a super-admin action). For a scheduled
cadence, run the endpoint from an external scheduler (e.g. a cron job or GitHub
Action) with a super-admin token and archive the resulting file to object
storage. Neon's automated backups already cover unattended durability.

### Restore from a tenant backup

The XLSX is primarily for records/inspection and targeted recovery. To restore
specific data, use the matching import tools (e.g. the student CSV import) or a
manual data-load by an operator. A full automated re-import of every table is
intentionally not exposed, to avoid accidental cross-tenant or duplicate writes.

## Retention & security

- Treat downloaded backups as **confidential** — they contain student and
  guardian PII. Store them encrypted / access-controlled.
- Delete local copies when no longer needed.
- Only super admins can generate tenant backups; the action is recorded in the
  platform audit log (`tenant.backup`).
