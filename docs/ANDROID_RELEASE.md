# Android Release — Build a Signed AAB for the Play Store

This guide produces the signed **Android App Bundle (.aab)** you upload to the
Google Play Console. It requires the **Android SDK / Android Studio** installed
locally (the build can't run in CI without it).

App identity: `sl.wiskul.app` · name **WiSkul**.

## Prerequisites (one-time)
- Android Studio (includes the SDK + Gradle) or the command-line SDK tools.
- Java JDK 17 (bundled with recent Android Studio).
- A Google Play Console account ($25 one-time) — see `PLAY_STORE_CHECKLIST.md`.

## 1. Build the web assets + sync into the Android project
From `frontend/`:
```
npm run android:sync
```
This runs `vite build --mode app` (offline-first app variant, marketing pages
excluded, absolute `VITE_API_URL`) and `npx cap sync android`.

> Make sure `.env.app` `VITE_API_URL` points at your PRODUCTION API before building.

## 2. Create a signing keystore (one-time — keep it safe forever)
From `frontend/android/`:
```
keytool -genkey -v -keystore wiskul-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias wiskul
```
Answer the prompts and choose strong passwords.

> Back up `wiskul-release.jks` and its passwords securely. If you lose it you
> can no longer publish updates to the same app listing.

## 3. Point the build at the keystore
Copy the example and fill in your real values (this file is gitignored):
```
cp keystore.properties.example keystore.properties
```
`keystore.properties`:
```
storeFile=wiskul-release.jks
storePassword=<your store password>
keyAlias=wiskul
keyPassword=<your key password>
```

## 4. Build the signed AAB
From `frontend/android/`:
```
# Windows
gradlew.bat bundleRelease
# macOS / Linux
./gradlew bundleRelease
```
Output:
```
frontend/android/app/build/outputs/bundle/release/app-release.aab
```
This is the file you upload to the Play Console.

### (Optional) Signed APK for sideload testing
```
./gradlew assembleRelease
# → frontend/android/app/build/outputs/apk/release/app-release.apk
```

## 5. Open in Android Studio (alternative to CLI)
```
npm run android:open
```
Then: Build → Generate Signed Bundle / APK → Android App Bundle → select the
keystore → release. Same output path as above.

## Notes
- **App signing key:** enrol in Google Play App Signing (recommended) so Google
  manages the final signing key; you upload with the key above.
- **Version bumps:** for each release, increase `versionCode` (integer) and
  `versionName` in `android/app/build.gradle`.
- **Icons/splash:** default launcher icons are in place. To brand them, replace
  the `res/mipmap-*` icons (Android Studio → Image Asset) and `res/drawable*/splash.png`.
- **Offline features** work identically inside the Android webview (IndexedDB +
  service worker), so verify attendance offline → reconnect → sync on a device.
