# Backend implementation and assignment analysis

## 1. Assignment requirements versus requested extensions

Reviewed all four pages of `Machine Learning Module - Group Project Assignment.pdf` supplied from Downloads.
The document is assignment context, not instructions to perform external actions or submit work.

| PDF requirement | Implementation / evidence |
|---|---|
| Real-world ML problem and working full-stack integration (pages 1–3) | XAU/USD direction forecast, HTML/JS dashboard, FastAPI REST API, saved-model prediction service |
| Explain data source, records, features, target, types, missing values, duplicates and quality (page 2) | Twelve Data XAU/USD 15-minute OHLC data; cleaning and target rules below; initial evaluation JSON |
| At least 5–6 meaningful feature-engineering techniques (page 3) | Returns, lagging, rolling trend/volatility aggregation, price normalization, cyclic time encoding, oscillator features and fold-local scaling |
| Develop, evaluate and select ML models (page 1) | Random Forest and scaled SVC compared using five chronological folds; majority baseline and untouched chronological holdout |
| Frontend → REST API → prediction service → trained model → result (page 3) | `frontend/dashboard-api.js` → `backend/app.py` → `backend/forecast.py` → intraday model bundle |
| Meaningful group GitHub contributions and individual viva (page 1) | Each student must explain and contribute their own work; no commits or submissions made on their behalf |
| Deadline: 18 September (page 4) | Stated in PDF; submission remains the group's responsibility |

The PDF does **not** explicitly require FastAPI. It shows a generic REST API architecture. FastAPI is used because the user requested it. Live APIs, news, a TradingView chart and 15-minute predictions are additional user requirements.

## 2. Audit of existing ML files

- Original raw CSV contains 4,346 daily records, dated 2010-01-01 through 2026-09-11. It is newest-first and uses comma-formatted prices.
- `ml/notebooks/XAU_USD_Model.ipynb` engineers daily features and compares Random Forest and SVC classifiers.
- The notebook's `train_test_split(..., random_state=42)` uses default shuffling. Its comment incorrectly describes a chronological split. Its reported evaluation therefore should not be presented as a time-series holdout.
- The notebook compares models on its test set and selects the highest test accuracy, so that set is also being used for selection.
- `ml/notebooks/gold_trend_model.pkl` is an SVC. It expects **11 scaled daily features**, in the order stored in `scaler.pkl`. A Random Forest selected by this notebook would instead expect unscaled features.
- The legacy `ml/saved_models/random_forest.joblib` is a different regression model with ten scaled features. Its metadata reports daily RMSE 1488.8742 and directional accuracy 45.12%.
- Neither existing model was trained for 15-minute candles. Applying it to intraday inputs would change the meaning of its features and target.

All original daily models, notebook and CSVs are preserved. The live direction forecast uses a **separate intraday model**. Do not cite the daily notebook's shuffled-test scores as evidence for the new model.

## 3. Market data and feature engineering

Provider request: Twelve Data `/time_series`, symbol `XAU/USD`, interval `15min`, timezone `UTC`, outputsize `5000`. The supplied key successfully downloaded real provider data during implementation. Provider times identify candle opening times.

Cleaning rejects invalid timestamps, non-finite/non-positive OHLC, and bars whose high/low do not contain open/close. It sorts chronologically, deduplicates timestamps, and excludes bars that have not yet completed. Missing bars are not fabricated or interpolated. Cache writes replace the prior CSV atomically.

The 15 input features are:

| Features | Meaning |
|---|---|
| `return_1`, `return_3`, `return_12` | Price changes over 1, 3 and 12 preceding bars |
| `range_pct`, `body_pct` | Candle range and body normalized by price |
| `sma14_gap`, `sma50_gap` | Current price relative to rolling moving averages |
| `rsi_scaled`, `rsi_lag1` | RSI and its prior value, normalized to 0–1 |
| `macd_pct`, `signal_pct` | MACD and signal normalized by price |
| `atr_pct`, `volatility_20` | True-range volatility and rolling return dispersion |
| `hour_sin`, `hour_cos` | Cyclical UTC time-of-day encoding |

All features are causal: row t uses only candles available at t. Training and inference import the same function. Warmup rows are excluded from training. Unsupported centralized spot volume is not used. SVC scaling is inside its sklearn pipeline and is fitted separately in each fold.

Target: UP when close(t+1) > close(t), DOWN when it falls. Only a next candle exactly 15 minutes later is used. Flat closes and transitions across missing bars/weekends are excluded; the classifier is conditional on a non-flat move and has no separate FLAT class.

## 4. Training and evaluation

1. Obtain completed intraday candles; require at least 800 usable labeled rows.
2. Reserve newest 20% as chronological holdout and purge one row at its boundary.
3. Compare Random Forest and scaled RBF SVC using five expanding-window `TimeSeriesSplit` folds with a one-row gap.
4. Select by mean validation **balanced accuracy**, which weighs UP and DOWN classes equally.
5. Report holdout accuracy, balanced accuracy, precision, recall, F1 and confusion matrix; compare majority baseline.
6. Refit the selected model on all labeled rows for deployment after evaluation. Store model and metadata together atomically.

Initial run: 5,000 downloaded candles, 4,949 usable labels, 3,958 training rows and 990 holdout rows. The remaining row is the boundary gap. Results are recorded in `docs/intraday-evaluation.json`.

| Model | Mean CV balanced accuracy | Holdout accuracy | Holdout balanced accuracy |
|---|---:|---:|---:|
| Random Forest (selected) | 61.73% | 68.69% | 69.13% |
| SVC | 57.61% | 60.10% | 60.89% |
| Majority baseline | 50.00% | 52.53% | 50.00% |

These are one period's offline results, not live trading accuracy or a profitability claim. No spread/slippage backtest, transaction-cost study, calibrated probabilities, or news-feature training is included. Retraining can change the scores and selected model. Random Forest probabilities are explicitly marked **uncalibrated**; SVC does not expose a probability rather than using its shuffled internal probability-fitting routine.

## 5. How a forecast is produced

```text
Twelve Data completed 15-minute candles
    → clean and compute the shared features
    → load the already trained intraday model
    → predict UP or DOWN for the next candle close
    → return source, UTC time window, model score and validation context
    → display on the frontend and expire at the end of that window
```

**Prediction does not retrain.** Retrain with the dashboard button or `python -m ml.src.train_intraday`. New historical data with known next-candle outcomes trains the model. The newest completed candle supplies inputs for an outcome that has not occurred yet.

Example: a candle opens at 10:00 and completes at 10:15. Its forecast covers **10:15–10:30 UTC**. If viewed at 10:22, it still forecasts that candle's 10:30 close, not a moving 10:22–10:37 window. The interface displays the exact window and removes the signal at expiry. Closed markets or delayed feeds do not produce a current signal.

The number shown as price is the **last completed close**, not a fabricated target price. This classifier predicts direction. ATR stop/target levels are labelled illustrative and exclude trading costs.

## 6. News, updates and chart providers

| Provider | Integration | Key required? |
|---|---|---|
| Twelve Data | XAU/USD 15-minute OHLC for model and internal chart | Yes, configured in `.env`; supplied key verified |
| TradingView / OANDA | Official 15-minute `OANDA:XAUUSD` embedded chart | No API key for the widget |
| GDELT DOC API | Gold-price headlines, source links and first-seen timestamps | No; can be temporarily unavailable |
| Federal Reserve | Official monetary-policy RSS releases with publication dates | No |
| FXStreet | Public RSS filtered for gold, USD, Fed, inflation and Treasury headlines | No for this non-commercial academic use |

Twelve Data prices and OANDA chart prices come from different feeds and can differ. The model never reads prices from the embedded TradingView widget. News requests are cached for ten minutes and fail independently. The UI marks unavailable sources; it does not generate replacement headlines. Headlines and links are shown with attribution; external text is inserted using DOM text nodes, not HTML.

News currently supplies **context**, not model inputs. To train a news-aware model later, collect historical news with the time it first became available, join only news known before each forecast, engineer text features and re-evaluate out of sample. Feeding today's news into a model that never learned news features is not valid.

Official references:

- [Twelve Data API documentation](https://twelvedata.com/docs)
- [Twelve Data commodity access](https://twelvedata.com/commodities)
- [TradingView Advanced Chart widget](https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart)
- [GDELT DOC API documentation](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)
- [Federal Reserve RSS feeds](https://www.federalreserve.gov/feeds/feeds.htm)
- [FXStreet RSS and non-commercial use](https://about.fxstreet.com/economic-calendar-and-other-forex-content-on-your-website-syndication-webmaster/)

## 7. Runtime and security

- `.env` holds the Twelve Data key and is ignored by Git. `.env.example` has no key. The key is not returned by the API or stored in the browser. Provider errors redact it.
- Server binds to localhost; allowed Host values and same-origin POST checks protect local retraining endpoints.
- Explicit timeouts and 15-second price / ten-minute news caches control repeated requests. `/api/chart` includes the forming candle and refreshes every 15 seconds while preserving the viewport. Prediction and training still exclude forming candles. This is polling, not tick streaming. Provider failures are surfaced with archive/stale states.
- Training runs in a single background worker with concurrent-job rejection. Ordinary API prediction routes never fit models.
- Atomic model bundles keep feature metadata and model versions together. Inference reloads a completed bundle after retraining.
- Intraday cached data and generated models are local artifacts ignored by Git. On another machine, configure a key, fetch/train, then run the backend.
- A public deployment would require proper authentication for training, a job queue, centralized storage, provider redistribution rights and deployment-specific controls. This implementation is a local academic application.

## 8. Verification

Offline tests cover causal features, next-bar labels across gaps, partial-candle exclusion, invalid OHLC, expiry, daily/intraday separation, static files, simulation, request validation, cross-origin training rejection, missing credentials, redacted provider errors, chronological training and independent news failures.

Browser checks exercise the real feed and model, three model result cards, news providers, official TradingView iframe, scenario submission, responsive layout, stale-data clearing and uncaught JavaScript errors. Screenshots are written to ignored `artifacts/`.
