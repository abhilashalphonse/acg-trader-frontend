# ACG Trader V4 — Locked Positions & Pending Orders Specification

Status: **APPROVED / FROZEN** (13 October 2026). Owner approval in ChatGPT conversation. Draft frontend PR #107 only. Do not merge without owner full-terminal preview acceptance.

## Purpose and boundaries
Broker-grade trading workspace for **ACG Trader**, applicable across Stocks, Forex, CFDs, Futures and Options when supported. **Never render ACG Funded-specific challenge limits, profit targets, funded-account parameters, or trading days** in either tab. No change to execution algorithms, backend risk enforcement, funding lifecycle, or default V3/mobile UI in this milestone.

## Visual contract — retain the exact approved screenshot structure
1. Header: Positions / Pending / History / Journal; Equity, Used Margin, Free Margin, Unr. P&L and expand icon.
2. Toolbar: Find position, instrument filter, Compact / Risk / Execution selector, display settings and Columns.
3. Table: current per-view columns, flags, BUY/SELL badges, chevron and action controls. Same IDs/order/selection under view switching.
4. Expanded row (inline): three columns in fixed order **Execution (including economics)**, **Risk & protection (including exposure intelligence)**, **Position activity**. No second dashboard, modal, fourth column or permanent action strip.
5. Footer: open-position count and valid gross/net exposure. Never add incompatible underlying units. Preserve V4 #09090B charcoal/silver aesthetic, density, spacing, 48px header, sticky headings, narrow horizontal scrolling, and dock resizing.

## Single home for each information type
- **Header:** account-level equity, margin used/free, floating P&L; not per-position details.
- **Compact:** instrument, side, lots, executable current price, unrealized P&L and quick Close/overflow.
- **Risk:** exposure (underlying and USD only with valid FX), actual position-reserved margin, SL/TP, potential loss, live P&L. Expand for margin-to-equity, effective leverage, live SL/TP distance in valid price units/pips/points and USD, potential reward, R:R, trailing status, cost-adjusted break-even and R-multiple only with immutable recorded initial-risk basis.
- **Execution:** entry price, original fill/open time, execution source if verified, order/position ID. Expand for actual fees, accrued financing/swap, partial-close realized P&L, gross/current unrealized P&L, true net accounting with documented inclusion (no double charging), fill references and holding duration.
- **Activity:** durable orders/deals/changes linked by actual IDs; events contain timestamp, what changed, and order/deal references. Do not fabricate creation/filled/modified events from browser-local journal. Show explicit unavailable when no trustworthy records.
- **Footer:** count, gross/net exposures where comparable; normalized USD totals require verified FX rates, otherwise omit.
- **Expanded view:** three columns retain stable placement, omit redundant row fields where displayed, and only promote additional valid details. No extra action toolbar.

## Actions and workflow
- **Row click:** select/highlight row, keep side Trade Execution UI unchanged; may focus corresponding chart symbol. **Chevron:** expand inline details; never opens side panel.
- **Compact Close:** existing confirm-close workflow (may intentionally open right-side management).
- **Risk SL/TP Add/Edit:** existing protection workflow, explicit user action.
- **Overflow:** deliberate Manage Position, Break-even, Trailing SL (enable/distance/disable), Partial Close (25/50/75/custom valid), Reverse, Duplicate, Review Close. One flow per action; avoid parallel mutation implementations, preserve backend market availability, risk, margin checks and confirmations. Reverse/Duplicate create exposure and must be reviewed/validated.
- **Chart badge click:** preserve existing V4 chart-management semantics; separate from dock row inspection.
- **Changing view/filter:** never reorder positions, lose selection, or cause command submission.
- **Pending Orders:** same five-area visual hierarchy and Compact/Risk/Execution modes, but show requested/remaining size, LIMIT/STOP/STOP_LIMIT trigger and limit prices, TIF/expiry, projected USD exposure/margin/risk (clearly ESTIMATED, never actual fill expense), real order status/activity; actions modify/replace/SL-TP/expiry/cancel using existing backend contracts. No realized P&L, swap, or active-position R-multiple for unfilled orders.

## Financial integrity / release gates
- Use accepted margin from account/position data; do not revalue legacy reserved margin due to unmerged leverage-policy backend PR #72.
- Confirm floating/gross/net, commission/swap inclusion from authoritative ledger before presenting net economics. Fees from historical deals not estimated into actual charges.
- Initial-risk R is **—** without persisted initial risk; remaining risk ≠ original risk.
- FX cross-currency conversions require valid exchange rates and freshness; if unavailable show **—** and reason.
- Account-level margin stop-out can be explained; never fabricate a deterministic position liquidation price.
- Numeric currency precision, timezone offset, quoted price precision and rounded-zero signed formatting all required.
- Hold PR #107 DRAFT/UNMERGED; run full-terminal browser acceptance and owner inspection on opt-in preview. Stage work M1 interaction; M2 financial data; M3 risk; M4 actions; M5 lifecycle; M6 pending; M7 E2E acceptance.
