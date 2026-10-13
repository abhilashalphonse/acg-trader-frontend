# V4 workspace correction milestone — accepted 13 October 2026

Scope is exclusively draft PR #107, opt-in desktop V4. Existing V3/mobile, new-order execution workflow and backend order/risk logic remain unchanged.

## Implementation order and acceptance

1. **History & Journal**: no History/Journal count badges; Positions and Pending counts retained. Separate 7D, 30D and rolling 1-calendar-month views. Records older than one month never rendered. History lists instrument, side, lots, entry/exit, UTC-grounded opening/close times, realized P&L, recorded commission/swap, close reason. Journal is clearly identified as local browser activity, not a durable execution ledger. History errors have explicit Retry, not a false empty state. Frozen pure-black V4 visual tokens.
2. **Inline expansion in all three views**: selecting a row or its chevron expands/collapses the same 3-column Execution / Risk & Protection / Position Activity detail block under that exact position across Compact, Risk and Execution. No auto-opening right-side management; all mutation actions remain explicit.
3. **Full detail visibility**: opt-in V4-only dock height ceiling and auto-enlargement so on normal desktop heights both selected position row and detail block are visible at once; narrower screens maintain in-dock internal scroll and sticky headings. V3 constraints untouched.
4. **Overflow menu**: viewport-aware fixed portal, auto-above/below, enough height for actions, internal scroll when necessary. Scrolling either dock or menu never dismisses the menu; Escape, outside click and action selection still dismiss.

## Commission vs spread
- Recorded position commission from accepted `commissionPaid`, recorded financing/swap and realized P&L are separate itemized fields, and are never subtracted twice from authoritative floating P&L.
- Current spread is inferred only from valid, non-stale, live BID/ASK: labelled **Current bid/ask spread**, in pips/ticks as applicable, **not an added fee**. When the current bid/ask is stale or absent, display `—`.
- Never fabricate historical opening spread from present quotes or treat missing commission/swap records as genuine zero.

## Safety & release
- No ACG Funded risk/targets/trading-day data added.
- Preserve pending-order flow and position management context: close/partial closes must use confirmation and backend risk/market checks.
- Test all scoped corrections on Chrome full-terminal fixture alongside prior 527 chart/order, 66 Positions, 48 reference workspace and 25 pending assertions.
- Await authenticated owner visual acceptance before merge.
