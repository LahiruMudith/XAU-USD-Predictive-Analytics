# System Architecture Overview: XAU/USD Predictive Analytics

## 1. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                               Next.js Frontend                                    |
|  - TradingView / Recharts Candlestick & Indicator Overlays                        |
|  - Real-Time Prediction Card (Next Close & Up/Down Trend)                         |
|  - Dynamic Take-Profit (TP) / Stop-Loss (SL) ATR Risk Management Calculator       |
|  - Model Metrics & Evaluation Comparison Dashboard                                |
+------------------------------------------+----------------------------------------+
                                           |
                                           | HTTP / REST API (JSON)
                                           v
+-----------------------------------------------------------------------------------+
|                                FastAPI Backend                                    |
|  - App Entry & CORS: app/main.py                                                  |
|  - Endpoints:                                                                     |
|      * POST /api/v1/predict     -> Price & Trend Direction Inference              |
|      * GET  /api/v1/indicators  -> Recent SMA, RSI, MACD, ATR values              |
|      * GET  /api/v1/historical  -> OHLCV Charting Feed                            |
|      * GET  /api/v1/signals     -> Buy/Sell recommendation + ATR TP/SL levels     |
|      * GET  /api/v1/metrics     -> Model Performance (RMSE, MAE, R², Accuracy)    |
|  - Pydantic Validation & Serialization Schemas                                    |
|  - Services: Inference Engine, Technical Indicator Calculator, Dataset Manager    |
+------------------------------------------+----------------------------------------+
                                           |
                                           | Model Loading & Feature Pipeline
                                           v
+-----------------------------------------------------------------------------------+
|                             Machine Learning Core                                 |
|  - Data Engineering: ml/src/data_loader.py, ml/src/cleaner.py                      |
|  - Feature Extraction: ml/src/feature_engineering.py (SMA, RSI, MACD, ATR)       |
|  - Supervised Training: ml/src/train.py (Random Forest, SVR, Baseline Regressor)  |
|  - Cross Validation & Tuning: ml/src/tune.py (TimeSeriesSplit, GridSearchCV)      |
|  - Model Evaluation: ml/src/evaluate.py (RMSE, MAE, R², MAPE, Directional Acc)   |
|  - Artifact Registry: ml/saved_models/ (random_forest.joblib, scaler.joblib)      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Component Breakdown

### Frontend (Next.js)
- **Framework**: Next.js (App Router), TypeScript, Vanilla / Modern CSS.
- **Role**: Provides the client interface for market analysts and traders to monitor gold prices, inspect technical indicator health, and view ML predictive signals.
- **Communication**: Consumes FastAPI endpoints via typed service client (`frontend/src/services/api.ts`).

### Backend (FastAPI)
- **Framework**: FastAPI, Uvicorn, Pydantic v2.
- **Role**: Provides asynchronous REST API endpoints with automatic Swagger documentation (`/docs`).
- **Logic**: Loads pre-trained `.joblib` models and feature scalers into memory upon startup; computes real-time indicator values for submitted OHLC payloads.

### Machine Learning Core (Python)
- **Framework**: Scikit-Learn, Pandas, NumPy.
- **Role**: Responsible for all data manipulation, feature extraction, model exploration, hyperparameter tuning, and model persistence.
