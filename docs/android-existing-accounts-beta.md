# Existing-account Android beta — read-only production sign-in

Status: **private APK candidate, not verified on an actual Android phone; no trading authorization**.

## What this beta does

- Uses the existing production ACG Trader backend for `/v1/auth/login`, `/v1/auth/refresh`, account grants, prices and history.
- Is **separate** from the staging-debug Android package: app ID `com.acgtrader.existingbeta`, display name ACG Trader Beta.
- Native WebView serves bundled React assets using `https://acg-trader.web.app` as the app-owned local hostname. This is the same **first-party web origin already allowed by the production backend**. Do not substitute an uncontrolled host. This origin is a client origin, **not an authorization mechanism**. The local WebView content must be inspected on a real device to verify it stays bundled rather than loading a remote website.
- The production service, deployment variables, trading-engine code and web main branch are not modified.
- The actual repository `public/acg-logo.png` is used for the launcher, no AI logo.
- Connect Prop defaults to `acg-funded` tenant, still editable for independent partner tenants. Requires an actual **trading account ID + trading password**. The ACG Funded **website login email** is not a native trader credential.
- First-party Supabase signup and new demo provisioning remain disabled until the native PKCE flow has separate acceptance.

## Non-negotiable read-only lock

- Compiled `VITE_ACG_ANDROID_READ_ONLY_BETA=true` in `.github/workflows/android-existing-account-apk.yml`.
- The shared REST request client fails closed for every non-GET/HEAD except the exact authentication paths login, refresh, logout and federation ticket exchange. No `POST/PUT/PATCH/DELETE` order, position, profile, account-setting or personal-demo request is permitted by the app.
- Mobile V4 renders account and trading history while replacing its order dock with a concise **READ-ONLY BETA** indicator; modification tools are disabled. Backend permissions remain authoritative and are not weakened.
- This client lock is **an accidental-action barrier, not a secure substitute for backend authorization**. It does not make production data a test environment. Do not share the APK broadly.

## Required device acceptance

1. Install the new app side by side with the staging APK. Confirm actual logo and Beta app identity.
2. Sign in with an existing production **trading account ID and trading password** under `acg-funded` or its real partner tenant, not website email/password. Confirm tenant/account isolation and error detail.
3. Verify first-party local app origin WebView retains bundled assets and makes permitted CORS requests; verify login, logout, process restart, access-token refresh and HttpOnly/Partitioned refresh-cookie persistence on a physical Android phone.
4. Read-only chart, market data, account balances, positions and history must load. No trade/pending/close/SL/TP/trailing command leaves the client; verify both buttons and direct API adapters fail closed.
5. Verify WebSocket authentication, account selection, background/wake, keyboard and chart gestures on actual Android.
6. Until device checks pass, do **not** describe this as validated existing-account login, or as production-ready.

## Artifacts and CI

On draft PR for `feat/android-existing-account-readonly-20261020`, `Android existing-account read-only beta APK` builds the APK. Download `acg-trader-existing-accounts-readonly` from its successful workflow run's Artifacts. CI runs a public unauthenticated production CORS and WS probe and checks bundle endpoints/read-only lock, then compiles with Capacitor 8 + Android SDK 36. The Firebase PR preview remains connected to **staging** and is not the same as this native production-account build.

This APK is debug-signed only and may be shared privately for device testing. Never publish it to Google Play as a production release.
