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

# 2. Migrations - SKIPPED: Database already exists with all schema and data
#    The previous Vercel account had everything set up. We're just redeploying
#    the application code without touching the database.
echo "Database migrations skipped - using existing database schema and data"

# 3. Frontend (outputDirectory: frontend/dist).
(cd "$ROOT/frontend" && "$(bin frontend vite)" build)
