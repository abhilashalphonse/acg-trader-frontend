# Mobile V4 sizing and chart management

Approved scope: 16 October 2026. Frontend only, visible through
`?acg_mobile_audit=1`. Desktop V4 and ordinary mobile retain their own presentation.

## Sizing

Lots, Margin $, Risk %, and Risk USD control one draft using the existing
`resolveV4PositionSizing` adapter. Switching representations derives the amount
from the current trade, rather than restoring unrelated defaults. Risk-to-risk
switching preserves the requested equity-based budget; all helpers show the
resolved volume, actual margin, or fee-aware stop risk after volume rounding.
Exposure/margin percentages use balance. Risk percentages use equity.
Unverified exposure conversion never claims a balance percentage.

Without SL, risk amount remains unset unless explicitly entered. Selecting SL
places a chart draft without focusing an input; an unset risk budget is derived
from the preserved volume and that stop. The first Buy/Sell interaction only
prepares a draft. Review and explicit placement remain separate.

## Existing trades

Mobile uses `V4FullTerminalOrders` for accepted positions and pending orders,
with a touch presentation in `V4ChartOrderLayer`. The former V3 overlays are
excluded only in mobile audit mode. Slim badges have 36px interaction areas.
Position entry is immutable. Pending entry, SL/TP, and the separate limit leg
of an existing Stop-Limit order can be edited on chart.

Selecting a badge replaces the existing 118px execution dock with management
controls. A proposed level is dotted; the accepted solid line remains fixed.
Apply submits through existing position/pending services. Discard sends nothing.
Accepted lines change only after a matching account snapshot. SL/TP removal,
full close, and pending cancellation require explicit inline confirmation.
While awaiting confirmation, duplicate actions are disabled.

Filled positions and existing pending orders retain their submitted volume
when levels change. Risk-based volume adjustment applies only to new drafts.
Account/symbol changes, new planning, and disappeared owners clear local edits.

## Validation

- `npm run check`
- `node tests/ui/mobile-audit.mjs`
- `node tests/ui/mobile-v4-management.mjs`
- Desktop browser smoke and position workspace regressions

Browser fixtures exercise real components with deterministic account snapshots
and no trading transport. They verify behavior and responsive geometry, not
authenticated production execution or final visual approval on a real phone.
Review the deployed mobile audit URL before approving a public mobile rollout.
