# ACG Trader V4 — Frozen Chart Order Design and Workflow Contract

**Version:** 1.0 | **Approved:** 2026-10-12 | **Status:** DESIGN AND WORKFLOW LOCKED; IMPLEMENTATION NOT RELEASE-APPROVED

This is the acceptance contract for a standalone, audit-gated, **desktop V4 chart-order UI layer**. It does not authorize a general release or modify the mobile interface, existing execution ticket, Lots slider, chart engine, trading APIs, margin/risk rules, backend or normal desktop experience.

## Design authority

- The **user-provided original reference image** shared on 2026-10-12 is the visual source of truth: three slim, consistently aligned Stop loss / SELL or BUY position / Take profit badges, subtle red/neutral/green outlines, compact typography, restrained graphite surfaces, real price markers on the right Y-axis and small price-level connection dots. Later explicitly approved interactions extend that reference but **cannot silently replace the art direction**.
- V4 must **not reuse old chart-order visual components**. Share only necessary chart coordinates, reliable financial utilities, validated order state and backend adapters.
- The previous execution ticket baseline (docs/ACG-EXECUTION-V4-FROZEN-BASELINE.md) remains the source for the trading ticket and financial integration where compatible. Its original two-row Market/Pending selector is superseded by the later explicitly approved **one-row Market | Limit | Stop** selector for new orders. Existing Stop Limit orders retain the two independently editable trigger and limit prices; new Stop Limit creation is not exposed.
- Anything beyond the approved visual and workflow contract requires explicit user approval, not an assumed design improvement.

## Explicitly locked workflow decisions (2026-10-12)

| ID | Trigger | Required behavior |
| --- | --- | --- |
| **WF-01 Drag TP/SL** | Drag an accepted Stop loss or Take profit, then release | Display **Save / Cancel**. The proposed price appears as a dotted temporary preview, and the accepted original remains a solid price line at its original price. **Save** validates and submits via existing backend; **Cancel** discards the draft with no backend mutation. **Never auto-submit on pointer release.** |
| **WF-02 Remove active TP/SL** | Click the **×** on an accepted SL or TP badge | Display **removal confirmation** identifying the target level and position. Confirm requests authoritative removal; Cancel changes nothing. Keep the accepted level visible until the backend confirms removal. **Never instantly remove on first click.** |
| **WF-03 Overlapping positions** | Multiple order/position badges occupy the same chart region | Preserve an **individual accessible badge for each** order/position. Automatically space the **badges only** by the minimal displacement necessary, using a subtle leader from a displaced badge to the actual price line. No badge aggregation, no price-line changes, no BID/ASK or Y-axis overlap. |

**Action semantics:** On a **draft** badge, × means **Cancel draft**. On an **accepted TP/SL**, × means **Request removal confirmation**. On a position entry badge, × retains the existing **close-position** action. These are never the same handler.

## Locked visual components

**Protection badge:** One consistent design for SL and TP: level name, actual instrument price, *supported/verified* currency P&L estimate and instrument **price-distance** percentage, plus a visible remove control when accepted. SL uses red and TP green with thin outlines, same geometry as the reference; no tiny legacy SL/TP chips, circular handles or heavy oversized panels. Unsupported estimate or FX conversion must display unavailable, not invented zero.

**Position badge:** Side, precise volume/units and actual price/verified P&L with restrained metallic, side-aware accents. **Only missing +TP or +SL shortcuts** may appear on the position badge. Once a protection is confirmed, its shortcut/chip disappears; the protection belongs to its separate chart level. On confirmed removal, restore the missing shortcut.

**Pending-order badge:** Confirmed BUY Limit/Stop uses the buy-side tone; confirmed SELL Limit/Stop uses sell-side tone. Existing Stop Limit has separate accepted stop trigger and execution boundary. Accepted orders must not resemble neutral draft levels.

**Price lines:** **Dotted** means unsubmitted new-order draft or temporary drag/edit preview; **solid** means backend-accepted pending entry, open position, or active SL/TP. Preserve accepted price lines and Y-axis price markers exactly during editing. **At most one full SL/TP information badge per level** while editing: display the proposed full badge on the dotted preview; original accepted solid price line stays without a second full badge. Once confirmed, show the accepted full badge.

**Quote rail and grouping:** Preserve the approved horizontal clearance from right-axis price markers and BID/ASK labels; coordinate-based badges remain centered on actual Y-values unless WF-03 collision spacing is required. Desktop hover/focus of entry, SL or TP reveals a thin hit-transparent connector and subtle highlighting **only** for that same position's confirmed levels. No connector for an unprotected position. Hide hover guide on leave/blur. Collision leader links are distinct from temporary hover connectors.

## One state model, server authority

| State | Chart | Action rule |
| --- | --- | --- |
| New draft | Dotted lines / draft badges | Local-only editing |
| Accepted pending order | Solid side-aware line / placed badge | Snapshot accepted by server |
| Open position | Solid entry / one position badge | Authoritative position snapshot |
| Attached active SL/TP | Solid colored lines / one badge per level | Authoritative accepted protection values |
| Drag/edit preview | Original solid remains + proposed dotted | On release show **Save / Cancel**; no automatic server command |
| Save in flight | Keep last confirmed solid | Disable duplicate actions; wait for authoritative response |
| Save accepted | Replace accepted value after server reconciliation | One new solid accepted badge |
| Save rejected/uncertain | Retain last confirmed accepted line | Show rejection or reconcile uncertain outcome |
| Remove confirmation | Retain active level | Confirm or Cancel; no mutation before Confirm |
| Remove accepted | Remove level from accepted snapshot | Restore +TP / +SL on entry badge |

**Non-negotiable invariants:** no duplicated full badge; draft never treated as accepted; no ghost preview replacing an accepted solid price; callbacks scoped by account, position/order ID and level kind, never symbol alone; no acceptance shown without server evidence; no stale edit after account/symbol/position lifecycle changes.

## Dragging, interactions and overlap details

- Require an intentional movement threshold before entering edit mode. No click mistaken for a drag, and no hidden automatic command on pointerup.
- On drag release, Save and Cancel must be visible, keyboard accessible and unambiguous without introducing a second full TP/SL badge. Escape cancels; pending command prevents duplicate Save.
- The accepted SL/TP × opens confirmation, not draft cancel. Rejected backend removal leaves active protection visible and provides feedback.
- Collision avoidance measures badge rectangles, quote rail, actual chart viewport and visible right scale after pan/zoom/resizing. Preserve distinct badges even for same-priced BUY/SELL positions; use minimal displacement and explicit precise line association; never modify a financial price to solve a visual collision.
- Hover and edit operations must not cross-highlight/cancel another order or position. Keep pointer interaction nonblocking over chart drag/zoom except on actual controls.

## Technical boundary

Implement a standalone desktop V4ChartOrderLayer with dedicated badge, accepted line, edit preview, confirmations, hover and layout components. **Do not import old chart-order presentation components for V4.** Retain existing TradingChart, account data, instrument contracts, execution/risk utilities and authoritative backend order/protection APIs. Propagate all required handlers explicitly through TradingTerminalV2 → DesktopTerminal → DesktopMultiChart → the V4 layer; no silent no-op defaults for mandatory actions.

The V4 chart layer must remain behind the build-time feature gate **and** URL opt-in (?acg_v4_audit=1). Neither is a trading-permissions boundary; use authenticated staging tests for trading acceptance.

## Mandatory acceptance before release

1. **Visual match to original supplied screenshot** for entry/SL/TP component geometry, type, colors, price-axis alignment and spacing; approved user pixel/interaction review.
2. **TP and SL drag Save/Cancel:** accepted price stays solid, moving draft dotted, one full badge, no backend call on release or Cancel, accepted value updated only after Save and server confirmation.
3. **Active TP and SL removal:** confirmation shown; Cancel unchanged; Confirm backend amendment and accepted-state reconciliation; rejected request retains active level; removed protection restores +TP/+SL.
4. **Overlapping positions/pending orders:** individual accessible badges at same/nearby prices; accurate leaders; zero BID/ASK/right-axis collisions, including narrow charts and multi-chart layouts.
5. **Trading lifecycle:** market/limit/stop drafts; pending Buy/Sell; existing stop-limit trigger/limit amendments; open position with none/one/both protections; fill, close, cancellation, rejection, concurrent server updates.
6. **Real wiring and server reconciliation:** test full nested frontend callback chain and authenticated staging simulated trades, not solely synthetic isolated fixtures. Cover uncertain responses, reconnect, symbol/account switches, market closure and revoked permissions.
7. **Financial and presentation correctness:** normalized prices and volumes; supported currency conversions; P&L labels and percentage definition; hover isolation; visible controls and accessible focus.
8. **Release gate:** all high-priority deep-audit issues fixed, CI/build and browser acceptance passed, authenticated staging verified, explicit visual owner approval, tested rollback, no changes to default/customer or mobile UI.

## Decision ledger / supersession

**Final user approval: 2026-10-12.** WF-01 Save/Cancel after release, WF-02 confirm removal on active TP/SL, WF-03 auto-space independent overlapping badges. Retain the approved original visual reference and later approved one-row selector, solid/preview distinction, single badge rule, side colors and hover connectors. **Supersede** earlier implementations that auto-submit edits, remove immediately, reuse legacy circular drag handles, duplicate TP/SL chips in a position badge or assume that badges may always remain vertically centered when overlapping.

**No implementation or customer release is authorized merely by freezing this document.**
