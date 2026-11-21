# Chart tools browser checks

The fixture uses the production chart, drawing layer, and indicator manager with deterministic synthetic candles. It supplies isolated React contexts and blocks backend requests. It does not authenticate, open a socket, or send orders. The fixture is not referenced by the production entry point.

Start the Vite development server with `npm run dev`, then open `/tests/fixtures/chart-tools.html` for manual review.

For optional browser checks, install Playwright locally without changing the dependency lockfile:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:ui
```

The runner defaults to `http://127.0.0.1:5173/tests/fixtures/chart-tools.html`. Set `CHART_QA_URL` if Vite chooses a different port. Set `PLAYWRIGHT_CHANNEL=msedge` to use an installed Microsoft Edge instead of downloaded Chromium. An existing Playwright installation can also be supplied through `NODE_PATH`.

Screenshots and results are written to ignored `tests/ui/artifacts/`, or to `CHART_QA_OUTPUT` when set.

Coverage includes full-name search, adding instances, invalid numeric inputs, Apply/Cancel, line creation and appearance, cancelling a live drag, zoom without changing stored coordinates, restricting drawings to the price pane, narrow viewport overflow, touch drawing creation, and indicator/drawing timeframe visibility.

These checks exercise the analysis UI. They do not validate a live broker connection, real-time feed latency, or execution.

## Detached mini terminal

With the Vite server running, run `npm run test:ui:mini`. This uses the isolated
`v4-positions-audit.html?acg_dock_audit=1` fixture and Chrome (override with `PLAYWRIGHT_CHANNEL`).
Set `VITE_ACG_EXECUTION_V4_ENABLED=true` when starting Vite to exercise the V4
desktop theme too. `MINI_TERMINAL_QA_URL` can override the fixture URL.

The checks cover actual Document Picture-in-Picture, the regular popup fallback,
copied styles, shared position/account updates, management tabs, account switching,
close confirmation and callback routing, resizing, docking/reopening, popup blocking,
and cleanup when the owner navigates away. All trading commands use fixture callbacks;
no live account is accessed. Screenshots are saved under `tests/ui/artifacts/`.

In the authenticated desktop audit (`?acg_dock_audit=1`), choose the small
**Pop out mini terminal** icon in the right-hand terminal rail. The chart has **no
attached floating order ticket**. The launcher works even when the full Trade
sidebar is open. Supported browsers open an always-on-top Picture-in-Picture
window; others open a regular popup that cannot stay on top. Keep the main
terminal tab open. Closing the popup leaves only the icon; no ticket returns
to the chart. The slim 270 × 560 px requested popup keeps the same height while
switching Trade, Orders and Positions. Browser-native Picture-in-Picture may\nenforce minimum window dimensions; the compact default Trade ticket fits
without vertical scrolling; longer editors scroll within the popup. The first
two position cards fit on screen and empty tabs have no explanatory footer.
The popup reuses the original quick-order and V4 management callbacks, session
and account state. Outside the audit flag the customer layout is unchanged.
