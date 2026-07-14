#!/bin/bash
set -e

# Resolve repo root — works regardless of where Vercel invokes this script
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Repo root: $ROOT"

echo "=== Building backend ==="
cd "$ROOT/backend"
npm install --legacy-peer-deps
npm run build

echo "=== Building frontend ==="
cd "$ROOT/frontend"
npm install --legacy-peer-deps
npx vite build

echo "=== Build complete ==="
