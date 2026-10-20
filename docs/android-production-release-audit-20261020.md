# ACG Trader Android release audit — 2026-10-20

## Decision
**Controlled production-account release candidate; NOT a public production/Play Store release.**

This app uses ACG Trader's production backend and may execute funded/challenge trading commands (simulated accounts, subject to server-authoritative risk and account grants). Do not distribute beyond the founder's authorized acceptance group until every remaining gate passes. Production web, Railway trading engine and ACG Funded server were not changed by these frontend native changes.

## Fixed and implemented
- Stable final Android package ID `com.acgtrader.app`, app name ACG Trader; real white logo, density-specific black splash, no invented branding
- Login defaults to `acg-funded` with separate editable Connect Prop tenant; username is trading account ID, NOT ACG Funded website email
- Native Android Back action closes overlays/focused chart; refuses to abandon trade drafts or uncertain executions
- App foreground/back-to-network triggers existing token refresh/account grant checks
- Native PKCE callbacks strictly accept `acgtrader://auth/callback` and only expected fields; Google OAuth uses system browser/Chrome Custom Tabs (if enabled)
- WebView refresh cookies supported, Android backups disabled, cleartext HTTP blocked, no relaxed backend CORS
- Source-controlled Capacitor 8/Gradle project, pinned native plugins and repeatable GitHub Actions build
- Release candidate compiles against the production API with V4 trading enabled and without the read-only beta's client block
- Browser mobile UI regression, JS authentication tests, production CORS/WS checks, APK manifest/package inspection; Android 15 emulator startup test is run in CI
- Separate signed AAB/APK pipeline requires protected keystore secrets and main branch; no generated debug key is used for Play release

## Outstanding external/acceptance gates
1. Production `POST /v1/auth/personal/demo` returns **404** without credentials: personal-demo creation is not active on the server. Supabase Auth email signup is enabled but email confirmation and backend account provisioning must complete before the native first-party signup can be enabled.
2. Supabase public auth settings show `external.google=false`; Google sign-in is not usable until the provider's authorized client setup is completed.
3. `acgtrader://auth/callback` must be registered as an allowed redirect URL in Supabase Auth before native OAuth and email recovery are enabled. Build flags deliberately keep these features off; test PKCE with real controlled inbox before activation.
4. Production auth **requires a valid tenant trading account ID/password**. No sensitive credentials were collected or tested by CI. Real-device login, restart/refresh-cookie persistence, safe account switching, WebSocket subscriptions, market orders, pending orders, SL/TP edits, uncertain response reconciliation, history and logout are acceptance conditions.
5. Google Play signing keystore, signing alias, passwords and Play Console release access have not been confirmed. Workflow `.github/workflows/android-signed-release.yml` fails closed without these secrets; debug APK from `.github/workflows/android-production-qa.yml` is for controlled owner testing ONLY.
6. The PR stack (onboarding #130, Android V1 #131, existing-account #132, release hardening #133) is not merged to main; the separate paired PR workflow failure must be understood before main rollout.

## Operational guardrails
- Do not copy production MongoDB users or passwords to staging.
- Never enable personal/demo feature flags just to make a button appear.
- Do not test trading commands with real money or unauthorized accounts. The ACG Funded challenge environment is simulated, but production changes still affect real customer state.
- Release GitHub Actions/Play signing only after previous gates are green; do not change app package ID after public Play listing.
- Debug APK is not a shipped version, regardless of whether it targets production API.
