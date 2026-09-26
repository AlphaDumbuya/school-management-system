# Content Security Policy (CSP)

A CSP is a browser-enforced allowlist of where scripts, styles, images, and
network connections may come from. It's a strong second layer against XSS: even
if malicious markup slips through, the browser refuses to run injected scripts
or exfiltrate to unknown origins.

## Current state: REPORT-ONLY

The frontend (served by Vercel) sends a `Content-Security-Policy-Report-Only`
header (see `vercel.json`). Report-only **does not block anything** — it only
logs violations to the browser console. This lets us confirm the policy doesn't
break the real app before we enforce it.

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: blob:;
font-src 'self' data:;
connect-src 'self' https: wss:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

## How to validate (do this on a preview/prod deploy)

1. Open the app in Chrome DevTools → Console.
2. Click through the main flows: login, dashboards, finance/payments, exports
   (jsPDF/html2canvas), ID cards, announcements, realtime (Socket.IO).
3. Watch for messages like:
   `[Report Only] Refused to … because it violates the following CSP directive …`
4. For each legitimate violation, widen the relevant directive. Likely
   candidates:
   - If Vite emits an inline bootstrap script → add a nonce or `'self'` is
     already set; check the exact source.
   - Tighten `connect-src https:` to your actual API origin once confirmed,
     e.g. `connect-src 'self' https://www.wiskulsl.com wss://www.wiskulsl.com`.

## Promote to ENFORCE

Once the console is clean across all flows, rename the header in `vercel.json`
from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`. Keep a
close eye on the first enforced deploy and roll back the rename if anything
breaks.

## Notes

- `style-src 'unsafe-inline'` is kept because `index.html` ships an inline
  splash `<style>` and some libraries inject inline styles. Removing it later
  requires refactoring those to classes/nonces.
- The API (Express) serves mostly JSON, so its CSP matters little; the SPA's
  CSP (this one, via Vercel) is where XSS protection lives.
- The Capacitor Android app loads the live site in a WebView, so it inherits
  this policy too — verify the app still works after enforcing.
