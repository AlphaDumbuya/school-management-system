#!/usr/bin/env bash
# Vercel build (vercel.json "buildCommand" is capped at 256 characters, so the
# logic lives here). Run from the repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Resolve a CLI from the workspace's own node_modules, else the hoisted root one.
bin() {
  local ws="$1" name="$2"
  if [ -x "$ROOT/$ws/node_modules/.bin/$name" ]; then echo "$ROOT/$ws/node_modules/.bin/$name"
  else echo "$ROOT/node_modules/.bin/$name"; fi
}

# 1. Backend bundle (served by api/index.ts from backend/dist).
(cd "$ROOT/backend" && "$(bin backend tsup)")

# 2. Migrations. Preview deployments share the production database, so they
#    skip migrations unless the preview has its own isolated database.
if [ "${VERCEL_ENV:-}" = "preview" ] && [ "${PREVIEW_DATABASE_ISOLATED:-}" != "1" ]; then
  echo "Preview build: database migrations skipped (preview shares the production database)"
else
  # --env development on purpose: the migration history in the database is recorded with the SOURCE file
  # names (001_initial_schema.ts ...). The "production" knex config reads the compiled .js files instead, so
  # knex stops with "migration directory is corrupt" and the whole deploy fails. This reads the same names
  # the history was written with, and applies only migrations that are really pending.
  (cd "$ROOT/backend" && "$(bin backend knex)" migrate:latest --knexfile knexfile.js --env development)
fi

# 3. Frontend (outputDirectory: frontend/dist).
(cd "$ROOT/frontend" && "$(bin frontend vite)" build)
