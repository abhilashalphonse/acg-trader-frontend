# ACG Trader — Aptoide submission pack

**Prepared:** 2026-10-23. **Status:** draft / not submitted. This is store metadata and a release checklist only; it does not authorize a production release.

## App record
- Store display name: **ACG Trader**
- Android package ID: `com.acgtrader.app` (from Android candidate)
- Version candidate: `1.0.0`, version code `1` (recheck final release build)
- Category candidate: **Finance**
- Price to install: **Free** (not a paid app; recheck whether the distributed APK contains in-app purchasing before declaring no IAP)
- Website candidate: `https://acg-trader.web.app/` (verify destination and ownership before submission)
- Support email: **REQUIRED — approved public support inbox pending**
- Privacy policy URL: **REQUIRED — not verified**
- Age rating / countries: **PENDING legal and platform review**
- Reviewer test account: **REQUIRED — provide a restricted-purpose simulated trading account through Aptoide's secure console, not source control**

## Short description
Chart-first trading workspace for demo and supported prop firm accounts.

## Full description (English)
ACG Trader is a chart-first trading workspace designed for Android. Explore market charts, follow instruments, and manage simulated trading activity in a focused mobile interface.

Connect to a supported proprietary trading firm using the account credentials provided by your firm. Depending on your account access, you can view live market quotes, use charting tools, place and manage simulated orders, monitor positions, adjust stop-loss and take-profit levels, and review trading history.

The mobile workspace brings charts, order entry, accounts, positions and history together in a compact interface designed for active traders. Features, market access and order permissions depend on the connected account and provider.

**Important:** ACG Trader currently supports simulated/demo and proprietary trading-program account workflows. It is not presented as a real-money brokerage service. Market data and trading carry risks; simulated results are not indicative of future performance. Availability of features varies by account.

## What's new — initial Android release
- ACG-branded Android welcome and supported prop-firm account connection
- Mobile V4 chart-focused workspace, chart tools and trading ticket
- Account, positions and history screens
- Native Android navigation, lifecycle handling and reconnection safeguards
- No automatic Volume indicator; 30-minute default chart timeframe on the approved Android candidate

Do not advertise independent demo signup until the backend demo provisioning path and associated auth flow are enabled and tested.

## Visual asset requirements
- Icon: **512 x 512** JPG/PNG, max 5 MB; use approved ACG mark from native project
- Feature graphic: **1024 x 500** JPG/PNG, max 5 MB; black/graphite background, original ACG wordmark, minimal white typography
- Screenshots: approved actual Android screens; minimum **320 x 320**, maximum **3840 x 3840**, aspect ratio limit **2:1**, max 5 MB each
- Suggested screenshot order: welcome, mobile chart, order ticket, positions, history; do not publish mock or misleading account balances

## Production build requirements
- App must use the approved final Android branch, not the test/debug artifact on PR #133 or #138.
- Produce a release-signed **APK** with verified final package ID/version and existing cross-store signing strategy; Aptoide does not accept `.aab` directly.
- Protect keystore and Aptoide API credentials in CI secrets; never commit or paste them into chat.
- Complete real-device auth/session refresh, WebSocket, chart, pending/market order, SL/TP, history, network interruption, account switching and logout acceptance.
- Validate working prop-account login and provide test access to reviewers; independently confirm whether personal/demo provisioning is ready before claiming that feature.
- Perform Android developer identity and package verification and Aptoide package ownership verification.
- Confirm financial-feature policy disclosures, regions, age rating, secure support contact, privacy policy and no misleading real-money trading promises.
- Ask Aptoide Connect to confirm suitability of the Capacitor native application because their restrictions include 'Web views'.
- Establish an active Aptoide Connect subscription for first manual review (published price **EUR 69 or USD 69/year**, subject to current terms).

## Submission sequence
1. Open https://connect.aptoide.com/; register and verify developer identity. Select **Add App -> Android -> Not on Google Play** if still unlisted and enter `com.acgtrader.app`.
2. Verify package ownership; enter store copy, financial/data declarations, reviewer account, privacy-policy URL and support details; upload icon, feature graphic and actual app screenshots.
3. After all acceptance gates pass, upload verified **release-signed APK**, select legally supported distribution countries and channels, and submit for manual review. Mark publication automatic only when approved for public release.

## Known outstanding dependencies
- Android work remains on an unmerged PR stack (`#130`–`#134`, `#138`); no verified store-ready signed APK is available in checked release evidence.
- Existing Android release audit reports backend personal-demo creation 404, Google provider disabled and pending Supabase redirect allowlisting.
- Physical-device signed-in order lifecycle acceptance is not yet recorded as complete.
- Aptoide developer account/subscription and Google developer verification status cannot be checked via GitHub.

## Sources
- Aptoide submit: https://docs.connect.aptoide.com/docs/app-submission-overview
- App info / art sizes: https://docs.connect.aptoide.com/docs/app-information
- Localized assets: https://docs.connect.aptoide.com/docs/locales-media
- APK rules: https://docs.connect.aptoide.com/docs/app-files
- Restrictions: https://docs.connect.aptoide.com/docs/app-restrictions
- Subscription: https://docs.connect.aptoide.com/docs/subscription
- Local audit: `docs/android-production-release-audit-20261020.md` on Android candidate
