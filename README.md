# ACG Trader

> A modern, real-time trading terminal built for sub-minute discretionary trading, MT5-familiar workflows, and proprietary trading environments.

ACG Trader is the trading interface and execution-facing layer of the ACG ecosystem.

The project is designed around a simple principle:

**Market data, charting, execution, risk, and presentation should remain separate systems connected through explicit contracts.**

---

## Overview

ACG Trader is being built for traders who already understand platforms such as MT5 and cTrader but expect a faster, cleaner, mobile-first experience.

The terminal prioritizes:

- chart-first workflows
- sub-minute trading
- live bid/ask visibility
- fast order entry
- familiar MT5/cTrader mental models
- mobile and desktop parity
- low cognitive switching cost
- backend-authoritative execution

```text
Market Data Provider
        │
        ▼
┌─────────────────────┐
│ Provider Adapter    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Market Data Engine  │
│                     │
│ • Tick normalization│
│ • Bid / Ask         │
│ • Symbol mapping    │
│ • Feed health       │
└──────────┬──────────┘
           │
      ┌────┴────┐
      ▼         ▼
 Candle       Quote
 Engine       Stream
      │         │
      ▼         ▼
 Chart      Execution
 System      Engine
                │
                ▼
        ┌───────────────┐
        │ Order Engine  │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Positions     │
        │ P&L / Margin  │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Risk Engine   │
        └───────┬───────┘
                │
                ▼
        Challenge / Account
             State
```

---

## Current V1 Architecture

The current terminal uses **TradingView Lightweight Charts** for rendering and **Twelve Data** for historical candles and real-time price data.

Current chart path:

```text
Twelve Data
    │
    ├── Historical OHLC
    │
    └── Realtime WebSocket ticks
                │
                ▼
        Browser aggregation
                │
                ▼
      Active timeframe candle
                │
                ▼
    TradingView Lightweight Charts
```

The execution path is intentionally separate from the chart path. Chart prices are presentation data and must not become the authority for fills, account state, risk decisions, or P&L calculations.

---

## Market Data

The market-data layer is responsible for converting provider-specific streams into a normalized internal representation.

Target capabilities include:

- WebSocket market feeds
- bid and ask prices
- tick-level updates
- symbol normalization
- provider symbol mapping
- stale-feed detection
- feed health monitoring
- reconnect handling
- multi-symbol subscriptions
- timestamp normalization

Example normalized quote:

```json
{
  "symbol": "EURUSD",
  "bid": 1.18421,
  "ask": 1.18427,
  "timestamp": 1789614325123
}
```

Provider-specific behavior should remain isolated behind adapters so the rest of the trading stack does not depend on one market-data vendor.

---

## Candle Engine

ACG Trader is designed to support internally generated candles from live market data.

Target intervals include:

```text
Tick
5s
15s
30s
1m
5m
15m
30m
1h
4h
1D
```

Sub-minute intervals are treated as first-class trading timeframes rather than UI approximations.

The candle layer is responsible for:

- OHLC generation
- candle boundary detection
- intra-candle updates
- timestamp alignment
- historical/live continuity
- missing-data handling
- stream synchronization

---

## Execution Architecture

The execution system is designed as a backend-authoritative service.

The frontend requests an action. The execution engine determines whether that action is valid and what resulting financial state is produced.

Target order support:

- Market Buy
- Market Sell
- Buy Limit
- Sell Limit
- Buy Stop
- Sell Stop
- Stop Loss
- Take Profit

Planned lifecycle:

```text
CREATED
   │
   ▼
VALIDATED
   │
   ▼
ACCEPTED
   │
   ├────► REJECTED
   │
   ▼
TRIGGERED
   │
   ▼
FILLED
   │
   ▼
POSITION
   │
   ▼
CLOSED
```

---

## Position, P&L and Margin Model

The trading backend is intended to maintain authoritative position state including:

- entry price
- direction
- volume
- current market price
- floating P&L
- realized P&L
- stop loss
- take profit
- used margin
- free margin
- margin level
- closure reason

Core account relationships:

```text
Equity = Balance + Floating P&L

Free Margin = Equity - Used Margin

Margin Level = Equity / Used Margin × 100
```

Financial calculations should be deterministic and independently testable.

---

## Risk Integration

Every trading action can ultimately be evaluated against challenge and account constraints before and after execution.

Example controls:

- maximum daily loss
- maximum total loss
- allowed instruments
- leverage restrictions
- trading-session restrictions
- account status
- maximum position exposure
- challenge-specific rules

```text
Order Request
     │
     ▼
Pre-Trade Validation
     │
     ├──── Invalid ───► Reject
     │
     ▼
Execution
     │
     ▼
Position Update
     │
     ▼
Post-Trade Risk Evaluation
     │
     ▼
Account / Challenge State
```

Risk enforcement must never depend on frontend validation.

---

## Terminal UX

The terminal is intentionally familiar to experienced MT5/cTrader users without copying their legacy layout constraints.

```text
┌──────────────────────────────────────────────────────┐
│ Symbol │ Timeframe │ Indicators │ Drawing Tools      │
├─────────────┬────────────────────────────────────────┤
│ Watchlist   │                                        │
│             │                Chart                   │
│ Symbols     │                                        │
│ Bid / Ask   │                                        │
│             │                                        │
├─────────────┴───────────────────────┬────────────────┤
│ Positions / Orders / History       │ Order Ticket   │
├─────────────────────────────────────┴────────────────┤
│ Balance │ Equity │ Margin │ P&L │ Market Status     │
└──────────────────────────────────────────────────────┘
```

Design priorities:

- maximize chart area
- minimize unnecessary chrome
- expose bid/ask where decisions are made
- keep timeframe switching compact
- make indicators and drawing tools immediately accessible
- optimize for scalpers and day traders
- preserve familiar trading terminology
- treat mobile as a primary client

---

## Engineering Principles

### 1. Deterministic financial state

The same sequence of market and trading events should produce the same account state.

### 2. Backend authority

The frontend renders state. It does not determine financial truth.

### 3. Provider independence

Market-data providers are adapters, not architectural dependencies.

### 4. Event-oriented design

Ticks, orders, fills, position changes, and risk events should be representable as explicit system events.

### 5. Observable infrastructure

Trading infrastructure needs clear visibility into feed health, stale prices, latency, WebSocket state, rejected orders, execution failures, and risk events.

### 6. Mobile is a primary client

Mobile support is part of the product architecture rather than a responsive-design afterthought.

---

## Technology Stack

### Frontend

- React
- Vite
- JavaScript / JSX
- TradingView Lightweight Charts
- WebSockets
- responsive trading UI

### Market Data

- Twelve Data historical data
- Twelve Data real-time WebSocket feed
- normalized internal symbols

### Planned Backend Responsibilities

- Node.js
- Express
- WebSockets
- MongoDB
- Redis where required
- market-data adapters
- execution engine
- position engine
- P&L / margin engine
- risk integration

---

## Development Status

```text
[✓] Trading terminal foundation
[✓] Chart-first responsive UI
[✓] Historical candle integration
[✓] Realtime market-data integration
[✓] Browser-side active candle updates

[~] Tick processing architecture
[~] Sub-minute candle support
[~] Live bid/ask integration across terminal UI
[~] Backend market-data service

[ ] Order engine
[ ] Pending orders
[ ] Position engine
[ ] P&L engine
[ ] Margin engine
[ ] SL / TP execution
[ ] Risk synchronization
[ ] Challenge-state synchronization
[ ] Trading history
[ ] Alerts
[ ] Production observability
```

---

## Local Development

Clone the repository:

```bash
git clone https://github.com/abhilashalphonse/acg-trader-frontend.git
cd acg-trader-frontend
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Set the required development variables and start Vite:

```bash
npm run dev
```

Current development configuration uses a browser-visible Twelve Data API key. Before public production deployment, market-data credentials and provider access should be moved behind ACG backend infrastructure.

---

## Repository Philosophy

ACG Trader is not intended to be a visual imitation of an existing trading terminal.

The objective is to preserve workflows traders already understand while replacing legacy architectural assumptions with a modern real-time system.

**The product should feel familiar immediately. The infrastructure underneath it should not be legacy.**

---

## Security

Do not report security-sensitive issues through public GitHub issues.

Security disclosures should be sent privately to the project maintainers.

Never commit production credentials, market-data secrets, account tokens, or trading infrastructure keys.

---

## License

Copyright © ACG.

All rights reserved unless otherwise stated.
