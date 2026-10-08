# ACG Trader Help Center — V1 release notes

## Scope
Frontend-only Help Center with:
- 5 Getting Started guides, 6 feature guides, 25 FAQs, and 9 troubleshooting articles in `src/help/helpContent.js`
- desktop dock Help icon + overlay drawer, mobile Account -> Help Center sheet
- keyword search, section lists, expandable FAQ answers, step-by-step tutorials, and support forms
- categorized bug reports, product feedback, and general support requests through existing ACG Funded support endpoints
- explicit human escalation for bug/feedback reports, and optional handoff for general support

No new trading/backend architecture, pricing, order, risk, execution, or market data changes.
No video/screenshot uploads in V1.

## Support API deployment requirements (release blockers)
1. Configure GitHub Actions secrets: `VITE_ACG_FUNDED_SUPPORT_STAGING_BASE_URL` for Firebase PR previews and `VITE_ACG_FUNDED_SUPPORT_BASE_URL` for Firebase live. Both must point to the appropriate funded-backend environment's HTTPS origin (no `/api` suffix). Never send preview reports to the production support API.
2. The funded backend must authorize the exact Trader frontend origin in its `CORS_ORIGINS` deployment allowlist (including preview/staging origins where used). This is a backend **configuration** change, not a trading engine change; do not alter without permission.
3. Confirm `POST /api/support/message` from the Trader origin returns `data.conversationId`; confirm `POST /api/support/conversations/{id}/escalate` returns status `ESCALATED`.
4. Confirm admin support shows the created conversation, Trader channel context, reporter-supplied reply email, and human escalation.
5. Verify that an anonymous report can be retrieved only using the same high-entropy support session. Trader bearer tokens are NOT sent to Funded.
6. Test the support flow using staging Funded API; never use the production support endpoint for staging smoke tests.
7. Verify real human follow-up processes for reporter emails; the submitted email is currently message text, not a verified authenticated Funded identity.

If the support service is unconfigured, the form shows an error directing users to their ACG Funded dashboard. The environment-specific values are forwarded by the Firebase preview/live GitHub workflows and do not require source-code secrets. Do not release publicly with this blocker unresolved.

## Data/privacy
- No trading auth tokens, passwords, cookies, complete trade ledgers, or payment data are submitted.
- Trader/Funded account identity is NOT asserted without a verified cross-service auth link.
- An email address is required for follow-up; category/description are required. Symbol, timeframe, browser and build metadata are included only after explicit opt-in.
- Requests have a hard message-length limit. Never automatically retry an ambiguous POST result.
- Human escalation is a distinct second call. An escalation error preserves the original conversation reference and displays a follow-up action.

## Content maintenance
All help content is intentionally editorial, not generated from customer-specific account state. Verify trading-day targets, leverage, SL requirements, session hours and margin thresholds against the relevant live account configuration. Do not publish staging-only India stocks, fractional shares, or shadow-mode news/weekend restrictions as production functionality.

## Verify
- `npm run check` (oxlint, node tests, Vite build)
- Desktop 1024px+: help icon above chart settings, help overlay without chart remount, resize, fullscreen, modal focus return
- Mobile: Account -> Help Center, scrollable sheet, close/back navigation, on-screen keyboard, small screens
- Focus: hotkeys Buy/Sell/Close cannot trigger while help is open
- Content: 45 articles, indexed search, empty results, FAQ expanding, related support CTA
- Form: empty fields, invalid reply email, max length, slow network, offline mode, success receipt, escalation retry
- Support: real staging integration and CORS + admin ticket check
- Trading: position/order drafts and chart selection survive Help open/close, no effect on execution state

Do not merge/deploy to production until staging integration and UX QA pass. 
