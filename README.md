# ACG Trader

ACG Trader V1 is a responsive, chart-first trading terminal designed for fast MT5-familiar workflows on mobile and desktop.

## GoCharting V1 architecture

The chart uses GoCharting's free attributed charting/data path directly. ACG Trader does not maintain a duplicate frontend REST/WebSocket market-data gateway for chart candles.

GoCharting owns chart rendering, realtime chart data, history, timeframes, indicators and drawings. ACG Trader owns terminal UI, account state, prop-firm risk state and execution integration.

The surrounding BUY/SELL and Market Watch values are explicitly demo shell values until a supported same-feed quote subscription is connected; they must not be treated as broker execution prices.

## Development

Run `npm install` and then `npm run dev`.
