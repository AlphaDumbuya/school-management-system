# Google Play Store — Publishing Checklist (WiSkul Android)

Everything needed to get WiSkul (`sl.wiskul.app`) downloadable on the Play Store.
Build steps are in `ANDROID_RELEASE.md`; this covers the Console + policy items.

## 0. Prerequisites
- [ ] Google Play Console account (**$25 one-time**) — https://play.google.com/console
- [ ] Signed AAB built (see `ANDROID_RELEASE.md` → `gradlew bundleRelease`)
- [ ] Privacy policy hosted (done): `https://www.wiskulsl.com/privacy-policy`

## 1. Create the app in Play Console
- [ ] App name: **WiSkul**
- [ ] Default language: English (en)
- [ ] App or game: **App**
- [ ] Free or paid: **Free** (the SaaS is billed separately, not via Play)
- [ ] Declarations: meets Developer Program Policies + US export laws

## 2. Store listing assets
- [ ] **App icon**: 512×512 PNG (32-bit, with alpha)
- [ ] **Feature graphic**: 1024×500 PNG/JPG
- [ ] **Phone screenshots**: 2–8, min 320px, 16:9 or 9:16 (login, dashboard, attendance, offline banner)
- [ ] **Short description** (≤80 chars): e.g. "School management for teachers — works offline."
- [ ] **Full description**: features, roles, offline attendance, Sierra Leone focus
- [ ] Contact email: support@wiskulsl.com · phone: +232 78 261 892

## 3. Privacy policy
- [ ] URL: `https://www.wiskulsl.com/privacy-policy` (self-hosted page shipped in the app)

## 4. Data safety form (required)
Declare the data the app collects/handles:
- [ ] **Personal info**: name, email address (account); student records managed by the school
- [ ] **App activity / app info & performance**: logs for operation & security
- [ ] **Files/docs**: uploads the school chooses to store
- [ ] Data **encrypted in transit**: Yes (HTTPS)
- [ ] Users can **request deletion**: Yes (via their school / support)
- [ ] Data **shared** with third parties: only service providers (email, storage) — not sold
- [ ] Note offline storage: role-scoped local copy, wiped on logout

## 5. Content rating
- [ ] Complete the IARC questionnaire (education/utility app → expect "Everyone")

## 6. Target audience & Families policy (IMPORTANT — minors' data)
- [ ] Target age: the app is used by **school staff/teachers** (adults) to manage student data;
      it is **not** directed to children as end users. Set target audience accordingly.
- [ ] If any audience under 13 is selected, comply with **Families policy** + Google Play
      Families requirements (extra scrutiny). Recommended: target **18+** (staff-facing tool).
- [ ] Do not include ads targeted to children.

## 7. App content declarations
- [ ] Ads: **No** (unless you add them)
- [ ] App access: provide **test credentials** (a demo teacher login) so reviewers can sign in —
      the app opens at the login screen with no public content.
- [ ] Government app: No · COVID-19 app: No · Financial features: the app itself doesn't take payments

## 8. Release
- [ ] Enrol in **Play App Signing** (recommended)
- [ ] Create a **Closed testing** track first (internal testers) → then **Production**
- [ ] Upload `app-release.aab`
- [ ] Set countries/regions (Sierra Leone + wherever schools are)
- [ ] Roll out

## 9. Post-launch
- [ ] Bump `versionCode`/`versionName` in `android/app/build.gradle` for each update
- [ ] Keep the keystore + passwords backed up securely (losing them blocks updates)

## Notes on reviewer access
The app has **no public/marketing pages** (app build) — it opens at the login screen.
Reviewers will need a working **teacher** account. Provide one in "App access" so the
review isn't blocked at the login gate.
