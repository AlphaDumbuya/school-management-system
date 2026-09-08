# Native app build (Capacitor Android/iOS) — used by `npm run build:app`.
#
# NOTE (task 20a): the installed app now loads the LIVE web bundle from
# capacitor.config.ts `server.url` (https://www.wiskulsl.com), so content
# auto-updates via Vercel. This bundled build is only a fallback if the live
# origin is unreachable. App mode is detected at RUNTIME via the Capacitor
# bridge (see src/lib/appMode.ts), so it no longer depends on VITE_APP_TARGET.
#
# VITE_APP_TARGET=native keeps this fallback bundle in app mode (no marketing
# pages) should it ever be served locally.
VITE_APP_TARGET=native

# Same-origin when loaded from the live site (server.url); kept absolute here so
# the fallback bundle can still reach the hosted backend if served locally.
VITE_API_URL=https://www.wiskulsl.com
