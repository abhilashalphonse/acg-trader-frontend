# ACG Trader V4 — Frozen Design & Production Integration Contract

Status: **DESIGN LOCKED / financial integration M1 underway / NO RELEASE AUTHORIZED**
Updated: 2026-10-11

## Approved baseline

- Pinned source commit: **fa73c3db80151b70fe267709f91fb67e547340a3**
- Frozen snapshot: **design/acg-execution-v4-baseline-1-frozen**
- Design-preview draft: **PR #89** (synthetic, demo only)
- Preview URL: https://acg-trader--pr-89-wcsco6kj.web.app/preview/order-ticket

The approved preview commit is the definitive **V4 Design Baseline 1**.
Never merge the synthetic preview calculations or synthetic click handlers into
the live terminal. Any visual restructuring requires explicit new approval.

### Frozen interface contract

- Chart-black (#09090B), metallic graphite (#202023), white-pill selection,
  silver/white typography. Blue only for Buy; red only for Sell.
- Desktop dock **330px minimum**, body scrollable, footer remains accessible;
  proportional wider layout. Do not alter mobile execution.
- Header: instrument identity/avatar, ellipsis and X; live status;
  shallow one-row Bid, Ask and Spread.
- Market/Pending pill; Position: **Lots | Margin $ | Risk % | Risk USD**;
  read-only instrument leverage; single editable large value between minus
  and plus, original slider and marks, one compact translated-value line.
  No second input/helper paragraph/Position Translator card.
- Exits: graphite Stop Loss and Take Profit cards with Enabled indicator,
  single amount input + rounded unit dropdown, canonical price and verified
  projected loss/profit + account impact. Unit choices: Price, Ticks,
  % Price, Risk USD/% Balance, Profit USD/% Balance as appropriate.
- One small Risk/Reward + Position volume row; Advanced disclosure;
  Required margin + Free after; conventional blue Buy and red Sell.
- **Instant Trade is deferred**. No one-click control, lightning icon,
  preset shortcuts or execution semantic changes.

## Live execution architecture that must stay authoritative

- src/components/trading-v2/desktop/DesktopOrderTicket.jsx — existing live
  dock/floating ticket, chart-linked planning, protection and callbacks.
- src/components/trading-v2/DesktopTerminal.jsx — dock sizing, floating ticket
  and integration with chart and terminal.
- src/pages/TradingTerminalV2.jsx — manual Market, planned Market and
  Pending (Limit/Stop/Stop Limit) lifecycle, risk/permission guards, account
  switching, error handling and execution coordination.
- src/utils/tradePlanExecution.js — executable-side entries and plan
  validation; src/utils/tradePlanNormalization.js and
  src/utils/tradingCommandNormalization.js — tick/lot rounding.
- src/utils/executionPricing.js — volume-band price estimate and
  consistent risk preview; src/utils/tradingRisk.js — margin,
  commission-inclusive risk sizing and opening requirement.
- src/utils/accountCapabilities.js — V1 stop-loss-required versus
  backend-confirmed V2 optional stop policy.
- src/utils/exposureAvailability.js and src/hooks/useTradingTerminal.js
  — quote/session/account availability, submission and reconciliation.
- **Backend remains the final authority** on quotes, sessions, account
  grants, funded lifecycle, margin/risk and order acceptance.

## Preview-to-live differences requiring precision work

1. Preview uses synthetic BTC/USD, $100k equity, one BTC/lot, $1 tick and
   fixed 10x leverage. All financial values in live UI must instead derive
   from actual instrument, account and backend permission metadata.
2. Current live execution accepts two native sizing modes: lots and risk.
   Margin $ must be converted to legal volume; Risk USD must map to
   equity-denominated risk percentage using existing fee-aware sizing.
   Neither conversion may silently increase the requested risk.
3. Where P&L or margin conversion to the account currency is not verified,
   the current frontend estimates return unavailable. Display unavailable
   as dash and fail closed; **never guess FX or show zero as a valid risk**.
4. Current Market manual lots may submit directly; protected/risk Market
   and Pending use chart projections, with Pending generally requiring an
   initial Buy/Sell selection then a second placement. Synthetic preview
   button behavior cannot override this workflow.
5. Stop Limit positions size/protect against the execution LIMIT leg,
   not the stop trigger. Market uses Buy Ask / Sell Bid and modeled
   size-dependent spread.
6. Live account or symbol switches cancel plans. Reset all V4 input
   drafts on switches; preserve floating mode and mobile behavior.
7. Existing desktop ticket sometimes requests skipRiskGuard=true in its
   execution callbacks. That does not mean the optional client Risk Guard
   was evaluated. Backend risk enforcement is authoritative. Audit this
   consciously at release, without weakening other checks.
8. SL risk amounts are fee-inclusive, TP reward may be gross, and
   price-distance Risk/Reward is a separate measure. Label values
   truthfully, and do not recalculate lots from monetary SL controls
   while simultaneously risk-sizing volume (circular dependency).
9. Real production Five-Market Stocks/Forex/CFDs/Futures/Options contract
   semantics require separate rollout. This V4 does not itself authorize
   unsupported product types.

## Implementation phases / exit gates

### M1: Financial adapter (underway on feature/acg-execution-v4-precision-m1)

- Build pure V4 mode adapter (Lots, Margin $, Risk %, Risk USD) around
  established live risk and execution-pricing utilities.
- Use instrument min/max volume and steps, fee-aware risk, equity, margin,
  spreads, stop-limit limit leg and actual free margin.
- Fail closed on unknown quote, plan, currency conversion or financial
  requirements. No backend requests and no production-component imports.
- Test Buy/Sell geometry, min/max, spread bands, commission, margin,
  cross currency, equity conversion and stop-limit.

### M2: Live presentation wiring (NOT STARTED)

- Recreate the frozen visuals in the production desktop ticket, using
  existing DesktopOrderTicket props and callbacks. Never import synthetic
  preview data in production.
- Wire Mode/slider/editable value/exit units to normalized trade plans,
  executable quotes and margin/risk engines.
- Keep chart drag and numeric edits synchronized; preserve floating and
  dock variants, account/symbol resets and existing safe execution workflow.
- Canonical stop/target value is always a normalized price. Unit changes
  change editing representation, not the actual level. Verify conversion
  quality/fees before allowing monetary units.

### M2 progress update — 2026-10-11 (gated implementation, NOT accepted)

- Added live presentation component `DesktopOrderTicketV4.jsx`, styled
  independently from the frozen metallic-black preview baseline.
- The desktop rail can render it only with the **disabled-by-default**
  build flag `VITE_ACG_EXECUTION_V4_ENABLED=true`. The existing ticket
  remains the default, and the floating order widget remains V3.
- Calls the existing chart planning, trade plan patching, execution
  and manual-order callbacks. Does not create a new backend endpoint.
- Live Bid/Ask/spread, instrument sizes/leverage, account equity/free
  margin, canonical SL/TP and pricing come from existing terminal data.
- Uses the fee-aware sizing and protection adapters from M1. Requires
  verified financial inputs before V4 execution.
- **Not yet validated** in an authenticated staging browser or with real
  simulated orders. Automated source/CI tests and build are necessary but
  not acceptance. Floating V4 remains a separate follow-on; no live
  order-flow redesign has been approved.
- Next: enable the flag in a controlled staging environment, verify
  market/pending Buy/Sell, account policy, price unit editor, chart drag,
  330px layout, focus and reconnection, then gather backend evidence.

### M3: Functional and regression acceptance (NOT STARTED)

- Market Buy/Sell manual and protected, V1/V2 mandatory/optional stops.
- Pending Limit/Stop/Stop Limit, editing/cancel/replace and expirations
  (GTC, TODAY, SPECIFIED).
- Four sizing modes, every exit-unit mode, tick/step rounding,
  commissions, volume-band spread and live account currency.
- Invalid geometry, margin/volume shortage, stale quote, market closed,
  grant revoked, blocked accounts, FX outage, missing valuation.
- Commands in flight, duplicates, timeout/unknown reconciliation,
  rejected/filled events, chart protection drag synchronization.
- Pixel/interaction review at 330px and wider; scrollable panel with
  visible footer; keyboard/focus; floating; unchanged mobile.
- Existing frontend tests and isolated staging trade acceptance must pass.
  Green CI alone does not prove trading execution works.

### M4: Staging and approved release (NOT STARTED)

- Enable only in staging for controlled accounts; gather backend
  execution and risk logs, rollback evidence and Funded lifecycle checks.
- Document any visible deviation with screenshot; obtain explicit owner
  approval before merging to main or deploying production.

**Change control:** Presentation is frozen; integration behavior is
constrained by existing executable contracts. Instant Trade stays deferred.
