# Native AI Chat — Phase 4A

## Audited baseline
Frontend main becf8b0301f4bb8cc5ebeb4110c510f1550021fd; backend main 957c07295748780e22498b80cfdd4399937e1cd9. Phase 3 foundation deployed disabled; offline fixture adapters and ledgers are not live inference endpoints. No frontend route may bypass server authorization.

## Design
Desktop V4 uses the existing resizable right sidebar (330 px minimum, viewport bounds) and 40 px launcher rail, alongside the chart and existing positions dock. AI is a single sidebar destination, not a floating window or separate trading layout. Mobile V4 uses existing header menu and a full-screen native modal, preserving the mounted chart and blocking background interaction. Existing chart and trade actions remain unchanged outside the preview. The draft is reset on account/chart identity changes or unmount, never persisted. Chart symbol/timeframe are labels only; chart inclusion is explicit and off by default. No positions, balances, session identifiers, candles, drawings or credentials are attached to any request.

## Phase 4A boundary
Development only, explicit acg_ai_preview=1 opt-in; a production build cannot enable this with a query parameter. Local composer, suggested question drafts, funding-choice preview, disabled send, no model selection until server capability discovery exists, no synthetic assistant answer. No network calls, analytics, storage, API keys, orders or billing from this component. Mobile legacy V3 fallback unchanged. Browser acceptance uses existing synthetic chart fixtures, not a real authenticated account. Screenshots in workflow artifacts require visual review before release.

## Proposed remaining increments (subject to review)
- 4B: secure native session/chat API and verified capability discovery; explicit read-only entitlement and provider/funding configuration, no client authority.
- 4C: durable scoped conversation lifecycle, retention/deletion, message idempotency and interruption/reconnect semantics; no prompt or answer logging outside authorized storage.
- 4D: real workspace context handoff, server-owned evidence assembly, verified response rendering and source/freshness labels. No trade actions.
- 4E: live BYO provider runtime with reviewed model contracts, secure credential custody, egress and cost safeguards, current permissions; isolated provider acceptance before activation. Managed credits remain blocked until real payment and durable spending controls pass.
- 4F: integrated desktop/mobile accessibility, financial/security, provider and browser acceptance; controlled staging pilot and approved production rollout. No live execution, autonomous agents or external AI integration in Phase 4.

Do not infer activation approval from Phase 3 deployment. No production changes in 4A.
