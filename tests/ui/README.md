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
