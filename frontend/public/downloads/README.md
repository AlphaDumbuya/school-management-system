# App downloads

Drop the signed release APK here to host it on your own domain, e.g.:

    frontend/public/downloads/wiskul.apk

Then set the marketing build env var so the "Download App" button appears:

    VITE_APK_DOWNLOAD_URL=https://www.wiskulsl.com/downloads/wiskul.apk

Build the APK with `docs/ANDROID_RELEASE.md` (`gradlew assembleRelease`).

After you publish to Google Play ($25), also set:

    VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=sl.wiskul.app

Both buttons are hidden until their URL is configured, so nothing broken shows.

> Note: files in this folder are served as-is. Do not commit large APKs to git;
> host them via your deploy pipeline or a release/CDN if size is a concern.
