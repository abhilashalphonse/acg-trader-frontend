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

## Completion update — 16 October 2026

- Existing chart levels support precise local price editing. Tap a selected
  badge or its dock readout, then tap the input to type. Preview normalizes to
  instrument ticks; Apply/Discard retain the existing authoritative workflow.
- Review replaces the same 118px dock with side/type, resolved lots, entry,
  SL/TP, estimated loss at SL, Back/Edit and explicit Place order.
- Sizing mode, amount and order type persist by account and instrument. The
  new-order dock remains mounted during chart management. Profiles explicitly
  update audit preferences and cannot interrupt an active trade operation.
- Unknown new-order outcomes provide Check status and Trades. Recovery queries
  the exact client order ID on the matching account; refresh alone or an absent
  history result never releases the exposure lock. Recovery markers survive
  reload. If the transport returned no usable client ID, the UI retains the
  lock and directs the trader to verify Trades.
- In-flight chart changes also survive reload without resubmission. Check
  status refreshes account evidence; matching accepted state releases the lock.
- The expanded chart palette contains Candles/Line, Fit and Return to live.
  Starting a draft collapses the palette to preserve chart space.
- Selected position actions include confirmed break-even, trailing-stop
  presets/disable and existing partial/full close. Pending-order details show
  size, protection and expiry policy; this update does not add volume/expiry
  amendment controls.
- Markets, Trades, Accounts and settings receive scoped V4 surfaces,
  typography, corners and navigation. Settings expose working chart-type and
  timeframe controls. Ordinary mobile and desktop do not use this style scope.

Additional browser acceptance: `node tests/ui/mobile-v4-completion.mjs`.
Real iOS/Android touch, keyboard and final visual acceptance remain owner review
steps, independently of the automated browser checks.

## Trades, History and Accounts layout correction — 16 October 2026

The earlier secondary-screen work styled legacy sheets. Mobile audit now mounts
dedicated V4 components; the original sheets remain the default outside the flag.

- Trades uses a compact account summary, Positions/Pending tabs, instrument
  filtering and expandable trade cards. Chart management uses the existing
  callbacks. Close, partial close, break-even and cancellation require inline
  confirmation; accepted commands wait for matching account snapshots.
- History separates closed positions from orders, keeps period/instrument
  filters visible, supports explicit UTC date ranges, groups rows by date and
  exposes full execution details on demand. Loading, failed, invalid-range and
  empty states are distinct. Existing P&L, commission and swap fields are shown
  without calculating fees a second time.
- Accounts leads with equity and separates margin metrics, the account switcher
  and expandable identity details. Switching uses the existing controlled account
  selection and synchronization flow; errors stay visible for retry.
- No screen focuses a text input on entry. Details and confirmations remain
  inline. Settings and Help continue through the existing callbacks.

Validation: `npm run check` (379 unit tests and production build), plus
`node tests/ui/mobile-v4-workspaces.mjs` (104 responsive/interaction checks at
360, 393 and 430px widths and landscape), and the existing mobile suites.
Fixtures verify callback wiring and snapshot reconciliation without sending
production trading commands. Real-device visual approval remains required.
