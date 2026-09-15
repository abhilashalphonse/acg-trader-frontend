# ACG Trader

ACG Trader V1 is a responsive, chart-first trading terminal designed for fast MT5-familiar workflows on mobile and desktop.

## V1 chart architecture

The terminal uses TradingView Lightweight Charts for rendering and Twelve Data for historical candles and realtime price ticks.

- Historical OHLC: Twelve Data `/time_series`
- Realtime ticks: Twelve Data WebSocket `/v1/quotes/price`
- Rendering: `lightweight-charts` 5.2.1
- Execution: remains separate from chart data and must use the broker/MT5 backend as the authoritative fill price

The chart aggregates realtime ticks into the active timeframe candle in the browser. This keeps the chart path small and avoids a large third-party terminal SDK.

The surrounding BUY/SELL and Market Watch values are still demo shell values until they are wired to the broker feed; they must not be treated as execution prices.

## Development

Copy `.env.example` to `.env` and set `VITE_TWELVE_DATA_API_KEY`, then run:

```bash
npm install
npm run dev
```

`VITE_` variables are exposed to browser code. This direct Twelve Data connection is suitable for development; before public production, move the API key and data proxy to the ACG backend.
