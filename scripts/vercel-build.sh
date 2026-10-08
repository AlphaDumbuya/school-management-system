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
  (cd "$ROOT/backend" && "$(bin backend knex)" migrate:latest --knexfile knexfile.js)
fi

# 3. Frontend (outputDirectory: frontend/dist).
(cd "$ROOT/frontend" && "$(bin frontend vite)" build)
