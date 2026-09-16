# XAU/USD Gold Intelligence — Frontend (Next.js)

This is the trading dashboard client for the XAU/USD Gold Price Prediction system,
rebuilt in **Next.js (App Router)**. It talks to the existing FastAPI backend
(`../backend`) over its REST API — no backend code changes are required.

## Features

- Candlestick / line price chart (via `lightweight-charts`) with SMA(20), EMA(50)
  and Bollinger Band overlays, live OHLC legend bar and crosshair inspection.
- TradingView advanced chart tab (OANDA:XAUUSD), with a configurable chart URL/symbol
  persisted to `localStorage`.
- RSI(14) / MACD(12,26,9) secondary indicator chart.
- Next-hour ML forecast card (model selector: Best / Random Forest / SVR).
- Scenario price simulator — submit a custom OHLCV candle and see the model's reaction.
- Model evaluation benchmark scoreboard (MAE, RMSE, R², Directional Accuracy).
- Twelve Data API modal to pull live market candles into the backend dataset.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Point it at your backend

```bash
cp .env.local.example .env.local
```

Edit `.env.local` if your FastAPI backend isn't running on the default address:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Make sure the backend is running (from the project root):

```bash
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Production build

```bash
npm run build
npm run start
```

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.js       # Root layout, fonts, global CSS
│   │   ├── page.js         # Dashboard page (state + composition)
│   │   └── globals.css     # Dark trading-terminal theme
│   ├── components/         # Header, TickerBar, charts, cards, modals
│   └── lib/
│       └── api.js          # Fetch helpers for the FastAPI backend
├── package.json
├── next.config.mjs
└── .env.local.example
```

## Notes

- `CandlestickChart` and `TradingViewWidget` are loaded with `next/dynamic`
  (`ssr: false`) since both need direct `window`/DOM access.
- CORS is already open (`allow_origins=["*"]`) on the FastAPI backend, so no proxy
  is required between this app (port 3000) and the API (port 8000).
