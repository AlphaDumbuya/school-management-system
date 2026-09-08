# App downloads

The Android APK is built in the cloud by the **Build Android APK** GitHub Action
(`.github/workflows/android-apk.yml`) and published to a GitHub Release on the
rolling `android-latest` tag. That gives a permanent, free download URL — no need
to host the APK on our own domain or commit it to git.

## Permanent download URL

    https://github.com/AlphaDumbuya/school-management-system/releases/download/android-latest/wiskul.apk

The workflow re-uploads this same file on every green build (overwrite), so the
URL never changes even as new builds ship.

## Make the "Download App" button appear (marketing site)

The button reads `VITE_APK_DOWNLOAD_URL` at build time and renders only when it's
set. The marketing site is built/deployed by Vercel, so set it there:

  Vercel → Project → Settings → Environment Variables → add

    VITE_APK_DOWNLOAD_URL = https://github.com/AlphaDumbuya/school-management-system/releases/download/android-latest/wiskul.apk

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
