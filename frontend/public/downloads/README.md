# App downloads

The Android APK is built in the cloud by the **Build Android APK** GitHub Action
(`.github/workflows/android-apk.yml`). On every push build the workflow now
**auto-commits** the fresh APK to `frontend/public/downloads/wiskul.apk`, so
Vercel serves it at our own domain — no manual download/copy needed (task 20b).

## Public download URL (served by Vercel from this folder)

    https://www.wiskulsl.com/downloads/wiskul.apk

This stays current automatically: each green push build overwrites the committed
APK, Vercel redeploys, and the URL serves the latest. (The GitHub Release
`android-latest` asset also exists, but the repo is private so that asset is not
publicly downloadable — hence we serve via our own domain.)

## Auto-updating app content (task 20a)

The installed app loads its UI from the live site (`capacitor.config.ts`
`server.url`), so most changes ship automatically on the next Vercel deploy —
users do NOT need to reinstall. A new APK is only needed for native changes
(app icon, permissions, Capacitor plugins).

## Make the "Download App" button appear (marketing site)

The button reads `VITE_APK_DOWNLOAD_URL` at build time and renders only when it's
set. Set it in Vercel → Project → Settings → Environment Variables:

    VITE_APK_DOWNLOAD_URL = https://www.wiskulsl.com/downloads/wiskul.apk

Then redeploy (a merge to `main` triggers a build automatically).

## Later: Google Play ($25)

After publishing to Google Play, add another Vercel env var to show the Play badge:

    VITE_PLAY_STORE_URL = https://play.google.com/store/apps/details?id=sl.wiskul.app

Both buttons stay hidden until their URL is configured, so the site never shows a
broken button.

## Hosting on our own domain instead (optional)

If you'd rather serve the APK from wiskulsl.com, drop the file here as
`frontend/public/downloads/wiskul.apk` and point `VITE_APK_DOWNLOAD_URL` at
`https://www.wiskulsl.com/downloads/wiskul.apk`. Avoid committing large APKs to
git — the GitHub Release approach above is preferred.
