# XAU/USD Predictive Analytics

FastAPI serves the dashboard and a separate, validated 15-minute direction model.

## Run (Windows PowerShell)

```powershell
cd D:\ML-Final\XAU-USD-Predictive-Analytics
.\.venv\Scripts\python.exe backend\run.py
```

Open **http://localhost:8765**. API documentation: **http://localhost:8765/docs**.
The server may already be running in the background. Stop your foreground server with Ctrl+C.

### First-time installation on another machine

Use Python 3.14 for the pinned runtime and saved intraday artifact.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\runtime-requirements.txt
Copy-Item .env.example .env
```

Set `TWELVE_DATA_API_KEY` in `.env`. Never put it in HTML, JavaScript or Git.
Then fetch data and train, and start the server:

```powershell
.\.venv\Scripts\python.exe -m ml.src.train_intraday
.\.venv\Scripts\python.exe backend\run.py
```

## What the dashboard does

- Fetches Twelve Data XAU/USD 15-minute OHLC candles and caches requests for 15 seconds. The chart polls every 15 seconds and displays the forming candle; it is not a tick-by-tick stream.
- Excludes the currently forming candle and uses the saved intraday classifier to predict the next completed candle's UP/DOWN direction.
- Shows the last completed close, model scores, forecast start/end in UTC, RSI, MACD, moving averages and illustrative ATR levels.
- Suppresses expired forecasts. If the live feed is unavailable, identifies the archive/cache explicitly.
- Displays an official TradingView OANDA:XAUUSD widget at a 15-minute interval. OANDA and Twelve Data quotes can differ.
- Shows gold and macro news from GDELT and FXStreet plus Federal Reserve monetary-policy updates; each source reports availability.
- Provides manual retraining and a hypothetical candle simulator. Ordinary prediction requests do not retrain the model.

News is context only. It is not fed into the current price-based classifier. Model scores are uncalibrated and forecasts are experimental.

## Project files

| Location | Purpose |
|---|---|
| `backend/app.py` | FastAPI routes and local request protections |
| `backend/market.py` | Twelve Data adapter and candle cache |
| `backend/forecast.py` | Saved-model inference and expiry checks |
| `backend/news.py` | Public news/RSS integrations |
| `frontend/` | Existing dashboard, charts and API client |
| `ml/src/intraday_features.py` | Shared feature calculations for training and prediction |
| `ml/src/train_intraday.py` | Time-series model comparison and artifact export |
| `ml/data/intraday/XAU_USD_15min.csv` | Downloaded 15-minute data (local, ignored by Git) |
| `ml/saved_models/intraday/model.joblib` | Atomic intraday model + metadata bundle (local) |
| `ml/saved_models/intraday/metadata.json` | Latest training report (local) |
| `ml/notebooks/` | Original daily notebook and its `.pkl` files, preserved |
| `ml/saved_models/` | Original daily regression artifacts, preserved |
| `docs/backend-implementation.md` | Assignment analysis, model audit and backend design |
| `docs/intraday-evaluation.json` | Snapshot of the initial real-data training result |

## REST API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Server, key configuration and artifact status (no secrets) |
| GET | `/api/historical?limit=100` | Completed candles, source, timestamps and freshness |
| GET | `/api/chart?limit=100` | Live chart candles including the forming candle; predictions remain completed-only |
| GET | `/api/predict/latest` | Next 15-minute candle direction or explicit unavailable state |
| POST | `/api/predict` | Hypothetical OHLC scenario, without saving or training |
| POST | `/api/fetch-live` | Refresh provider history (15-second cache applies) |
| GET | `/api/indicators` | Latest technical indicators |
| GET | `/api/metrics` | Cross-validation and holdout results |
| POST | `/api/models/train` | Start a background training job |
| GET | `/api/models/training` | Training progress/result |
| GET | `/api/news` | News with source timestamps and provider status |
| GET | `/api/market/details` | Instrument, providers and inference explanation |

## Verification

```powershell
.\.venv\Scripts\python.exe -m pip install pytest
.\.venv\Scripts\python.exe -m pytest backend\test_app.py -q
node --check frontend\app.js
node --check frontend\dashboard-api.js
```

Optional browser integration check (requires Edge, Playwright, a running server and internet):

```powershell
.\.venv\Scripts\python.exe -m pip install playwright
.\.venv\Scripts\python.exe -X utf8 backend\browser_check.py
```

## Provider access

The configured Twelve Data key successfully fetched XAU/USD intraday data during implementation. Other keys/plans may have different entitlements. GDELT and Federal Reserve feeds need no key. FXStreet public RSS is used for this non-commercial academic application. News, fonts and embedded TradingView need internet access.
