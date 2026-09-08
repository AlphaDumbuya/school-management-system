# Native app build (Capacitor Android/iOS).
# Used by `npm run build:app` (vite --mode app). Excludes the public marketing
# site so the app opens straight at the auth pages.
VITE_APP_TARGET=native

# The app runs from a bundled origin (https://localhost) inside the Android
# webview, so API calls MUST use an absolute URL to the hosted backend.
# Change this to your production API origin.
VITE_API_URL=https://www.wiskulsl.com
