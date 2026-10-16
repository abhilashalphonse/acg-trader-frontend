# Mobile chart audit – implementation and acceptance notes

## Visibility and deployment

The production-default mobile shell is unchanged unless the page URL contains
`?acg_mobile_audit=1`. The check is applied only after the existing
`min-width: 1024px` desktop routing decision; desktop V4 is unchanged.
A URL query is an opt-in rendering switch **not an access control**. Auth,
account permissions, and server trading checks remain authoritative.

The audit path lives in the same production Firebase build. Changes use a
technical PR and paired acceptance checks before merging into protected `main`.
The merge triggers Firebase production deployment. Visual owner review happens
on the real opt-in URL, not the Firebase PR preview.

## Reuse

- `MobileTraderShell` retains the real account, market, draft, market/pending
  execution, and reconciliation hooks.
- `MarketPanel`/`ChartArea` reuse the existing price coordinates, order
  draft overlay, and drawing rail; the horizontal timeframe ribbon is omitted
  only for audit.
- `MobileAuditHeader` presents a 48px compact instrument/timeframe header.
- `MobileAuditExecutionDock` presents three fixed rows (32/20/48px)
  with order/SL/TP and sizing popovers overlaying the chart.
- The `resolveV4PositionSizing` adapter maps Lots, Margin, Risk Percent,
  and Risk Amount onto the existing lots/risk execution contract.
- Every final submission still passes through `executePlan`, with
  `validateTradePlanForExecution`, current quotes, existing trading
  commands, and the backend's actual order status.

## Chart-first interaction refinement

- The unit label beneath the amount opens sizing modes directly. Changing units
  does not focus an input. Tapping the amount opens the precise editor; its
  numeric input stays unfocused until the trader explicitly taps it.
- First SL/TP activation adds a normalized, unsubmitted chart level using the
  existing default-distance policy. A second tap offers precise V4 unit editing.
- V4 protection conversion and circular-risk restrictions remain authoritative.
  Inputs use a 16px font to avoid iOS focus zoom; the dock keeps 32/20/48px rows.
- New audit draft badges are thin, dotted, and visually distinct from accepted
  positions. Their 36px drag areas have a 5px movement threshold. Cancellation
  restores the original draft price; live drag previews update the sizing adapter.
- Chart risk drawings carry their actual Risk % budget into the audit dock.
  Changing order type preserves sizing and protection prices while revalidating
  entry geometry. No local edit submits an order.
- Popovers dismiss on outside press or Escape. Only one dock editor is open at
  once; the dock has no shadow or additional expansion region.
- Before direction selection, the Lots/Margin helper is explicitly indicative,
  based on the current buy quote and the existing adapter. It is not executable.

## Existing contract limitations

- Risk Percent and Risk Amount require an SL and an instrument whose P&L
  currency equals the account currency; the current risk adapter does **not**
  synthesize cross-currency risk sizing from indicative FX.
- Cross-currency margin estimates depend on fresh subscribed FX quotes. If
  verification is missing, the Margin mode cannot be used for execution.
- Notional in account currency is shown only when directly verified in
  `resolveV4PositionSizing`; otherwise the helper identifies the quote
  currency instead of claiming a fabricated USD amount.
- The order execution service has no new API contract or client-generated
  retry mechanism. Ambiguous submissions block a second audit attempt until
  reconciliation or a new account/instrument context is established.
- User-entered monetary values continue to follow existing frontend precision
  and server-side validation. No replacement decimal financial engine has
  been introduced.

## Acceptance

`npm run lint`, `npm test`, and `npm run build` must pass.
The real-Chrome audit fixture covers 360, 375, 393, 430 CSS pixels, a short
viewport, landscape, dock/header geometry, open popovers, stage transitions,
SL-driven risk recalculation, TP independence, and duplicate-tap protection.
The browser fixture uses deterministic values and **never** places live orders.

Browser fixture pass alone is not a live authenticated order-fill guarantee.
Before making mobile audit the normal customer UI, complete an authenticated
test-account pass for Market/Limit/Stop, stale quotes, and known/unknown
submission outcomes. The approved audit URL remains optional until then.
