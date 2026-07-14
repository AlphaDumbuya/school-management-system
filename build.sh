#!/bin/bash
set -e

# Get the directory where this script lives (repo root)
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Building backend ==="
cd "$ROOT/backend"
npm install --legacy-peer-deps
npm run build

echo "=== Building frontend ==="
cd "$ROOT/frontend"
npm install --legacy-peer-deps
npx vite build

echo "=== Build complete ==="
