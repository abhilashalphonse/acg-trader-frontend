# ACG Trader Android V1 — private beta

Status: **Android native shell/build candidate; trading-session and physical-device acceptance pending.** This branch is stacked on the mobile onboarding PR #130 and is not a production release.

## Scope and isolation

- Reuses the existing Mobile V4 React terminal, authorized trade execution and account management. No new execution engine.
- Capacitor launches local, bundled Vite assets rather than pointing WebView at Firebase.
- Android first launch uses the existing opt-in welcome component. Returning authorized trader sessions route to `/terminal`; explicit Connect Prop, authentication, and ACG Funded federation routes win.
- Native login routes retain the two distinct identities; Connect Prop requires tenant ID and trading credentials. Personal demo is **disabled** in the initial debug build until isolated backend provisioning and OAuth callback behavior are validated.
- `com.acgtrader.beta` is an internal **beta-only** package ID. It is not a public store app ID.
- The APK is built against `https://discerning-presence-staging.up.railway.app`, never Railway production. The workflow rejects production URLs in the compiled bundle.
- Public web, Firebase Hosting, Railway production, iOS, desktop V4, and ACG Funded integration remain unchanged.

## Build

Workflow `.github/workflows/android-debug-apk.yml` runs on Android V1 PRs and manually on the workflow's default-branch availability. It runs `npm ci` against the unchanged frontend lockfile, installs an isolated pinned Capacitor 8 toolchain on the CI runner, builds **staging** web assets, generates Android project, stamps the *actual repository* `public/acg-logo.png` into the app launcher icon and builds an unsigned-for-production **debug** APK.

Retrieve `acg-trader-android-staging-debug` from a successful GitHub Actions run's Artifacts section. The APK is signed by Android's throwaway CI debug key and **must not** be published to Google Play or used for live trading.

We intentionally do not check in the generated `android/` Gradle tree or modify `package.json`/`package-lock.json` in this first exploratory build. Before store submission, commit the verified platform source, lock the dependencies in the frontend lockfile, establish stable release signing and an explicit production package ID.

## Device acceptance required before claiming a functional trading beta

1. Install the APK on emulator and physical Android. Verify authentic ACG icon and pure-black welcome/Connect Prop/personal preview screens.
2. Staging API must permit the native HTTPS local origin `https://localhost`; audit the WebView cookie partition/refresh behavior explicitly. Do not weaken production CORS or cookie security.
3. Sign into an isolated **staging** partner tenant, fully restart application, verify restored/revoked trader session, and verify full logout.
4. Run one staging simulated market and pending-order lifecycle including disconnect/background/resume, uncertain-execution reconciliation, position close, and account switching guards.
5. Validate keyboard, gestures, chart drawing/editing, safe areas and Android system back behavior on several Android sizes.
6. Before enabling personal signup, implement and verify native browser PKCE callback/deep-link handling; verify one-and-only-one first-party $100k *virtual* demo from backend ledger. No personal demo credentials are enabled as part of Android packaging.
7. Resolve the separate paired workflow failure on onboarding PR #130 before production rollout; keep staged code isolated until approved.

There is no assumption that a green Gradle build proves authentication, session continuity, Google OAuth, or successful trading.

## Native dependency strategy

During this **candidate build only**, GitHub installs exact major-matched `@capacitor/core@8.0.0`, `@capacitor/android@8.0.0` and `@capacitor/cli@8.0.0` without modifying committed web dependencies. Android project generation runs in CI from `capacitor.config.json`. Once APK validation passes we will commit generated native source and dependency lock as a separate reviewed milestone.
