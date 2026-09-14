# XAU/USD Predictive Analytics 📈🥇

> **Machine Learning Predictive Analytics & Real-Time Trading Intelligence for Spot Gold (XAU/USD)**  
> *IJSE 4th Semester Machine Learning Final Project*

---

## 🏛️ System Architecture

```text
+-----------------------------------------------------------------------------------+
|                           Next.js Web Frontend (Port 3000)                        |
|  - Real-time Price Chart & Momentum Indicators                                    |
|  - ML Next-Day Close Forecast & Up/Down Trend Direction                           |
|  - ATR-based Take Profit (TP) / Stop Loss (SL) Risk Calculator                    |
|  - Model Diagnostics & Feature Importance Visualizer                              |
+------------------------------------------+----------------------------------------+
                                           |
                                           | HTTP / REST (JSON)
                                           v
+-----------------------------------------------------------------------------------+
|                           FastAPI Backend (Port 8000)                             |
|  - REST API Endpoints: /predict, /indicators, /historical, /signals, /metrics     |
|  - Pydantic Request/Response Validation                                           |
|  - High-Speed In-Memory Model Deserialization & Indicator Calculation             |
+------------------------------------------+----------------------------------------+
                                           |
                                           | Serialized Artifacts (.joblib)
                                           v
+-----------------------------------------------------------------------------------+
|                           Machine Learning Engine                                 |
|  - Data Engineering: Ingestion, Chronological Sorting, OTC Cleaning               |
|  - Technical Indicators: SMA (14, 50), RSI (14), MACD (12,26,9), ATR (14)         |
|  - Supervised Training: Random Forest, SVR, Baseline Regressors                   |
|  - Time-Series Validation: TimeSeriesSplit (5 Folds, Zero Lookahead Leakage)      |
|  - Metrics: RMSE, MAE, R², MAPE, Directional Accuracy %                           |
+-----------------------------------------------------------------------------------+
```

---

## 👥 3-Member Group Role Allocation (IJSE Viva Defense)

| Member | Primary Focus | Key Deliverables | Core Responsibilities |
| :--- | :--- | :--- | :--- |
| **Member 1** | **Data Engineering & Feature Pipeline** | `ml/src/data_loader.py`<br>`ml/src/cleaner.py`<br>`ml/src/feature_engineering.py`<br>`ml/notebooks/01_*.ipynb`<br>`ml/notebooks/02_*.ipynb` | Ingestion, handling OTC Gold nuances (dropping empty volume, chronological ordering), feature extraction ($SMA_{14}$, $SMA_{50}$, $RSI_{14}$, $MACD$, $ATR_{14}$), target variable engineering. |
| **Member 2** | **ML Modeling & Evaluation** | `ml/src/train.py`<br>`ml/src/tune.py`<br>`ml/src/evaluate.py`<br>`ml/saved_models/`<br>`ml/notebooks/03_*.ipynb` | Supervised model implementation (Random Forest, SVR), `TimeSeriesSplit` cross-validation, hyperparameter tuning, regression metrics ($RMSE$, $MAE$, $R^2$), directional accuracy, and `.joblib` serialization. |
| **Member 3** | **FastAPI & Next.js Full-Stack Integration** | `backend/app/`<br>`frontend/src/`<br>`frontend/src/services/api.ts`<br>`backend/run.py` | FastAPI REST API endpoints (`/predict`, `/indicators`, `/historical`, `/signals`, `/metrics`), Pydantic validation, Next.js dashboard UI, interactive price charting, ATR TP/SL calculator, and end-to-end integration. |

---

## 📁 Project Directory Structure

```text
XAU-USD-Predictive-Analytics/
│
├── backend/                               # FastAPI Application & REST API
│   ├── app/
│   │   ├── main.py                        # FastAPI entrypoint, middleware, CORS
│   │   ├── config.py                      # App settings & model file paths
│   │   ├── api/v1/endpoints/
│   │   │   ├── predict.py                 # POST /api/v1/predict (price & trend inference)
│   │   │   ├── indicators.py              # GET /api/v1/indicators (live indicator values)
│   │   │   ├── historical.py              # GET /api/v1/historical (OHLCV chart data)
│   │   │   ├── signals.py                 # GET /api/v1/signals (Buy/Sell + ATR TP/SL)
│   │   │   └── metrics.py                 # GET /api/v1/metrics (RMSE, MAE, R², Accuracy)
│   │   ├── schemas/                       # Pydantic Request & Response Schemas
│   │   │   ├── prediction.py
│   │   │   ├── indicator.py
│   │   │   └── market_data.py
│   │   └── services/                      # Business & Model Inference Services
│   │       ├── model_service.py           # Loads joblib models & runs inference
│   │       ├── indicator_service.py       # Indicator computation service
│   │       └── data_service.py            # Historical dataset manager
│   ├── tests/                             # Unit and API integration tests
│   ├── requirements.txt                   # FastAPI, Uvicorn, Pydantic, Scikit-learn, etc.
│   └── run.py                             # Development server bootstrap script
│
├── frontend/                              # Next.js Modern Web Application
│   ├── src/
│   │   ├── app/                           # Next.js App Router
│   │   │   ├── layout.tsx                 # Root layout, theme provider, navbar
│   │   │   ├── page.tsx                   # Main Dashboard (Trading Chart & Forecast)
│   │   │   ├── indicators/page.tsx        # Technical Indicators analysis page
│   │   │   ├── models/page.tsx            # Model Diagnostics & Metrics comparison
│   │   │   └── globals.css                # Financial dashboard dark theme tokens
│   │   ├── components/
│   │   │   ├── charts/PriceChart.tsx      # Interactive gold price action chart
│   │   │   ├── dashboard/PredictionCard.tsx # ML forecast card & confidence
│   │   │   └── dashboard/TPSLCalculator.tsx # ATR volatility Take Profit / Stop Loss
│   │   ├── services/api.ts                # API client consuming FastAPI
│   │   └── types/                         # TypeScript interfaces
│   ├── package.json                       # Next.js, React, Lucide-react
│   ├── tsconfig.json                      # TypeScript configuration
│   └── next.config.js                     # Next.js configuration & API proxying
│
├── ml/                                    # Machine Learning & Data Pipeline Core
│   ├── data/
│   │   ├── raw/                           # Raw datasets (XAU_USD_Historical_Data.csv)
│   │   └── processed/                     # Cleaned & engineered CSVs (XAU_USD_Final_Engineered.csv)
│   ├── notebooks/                         # Jupyter Notebooks for EDA & Viva Presentation
│   │   ├── 01_data_exploration.ipynb      # Ingestion, missing values, distributions
│   │   ├── 02_feature_engineering.ipynb   # Technical indicators & target variable logic
│   │   └── 03_model_training_evaluation.ipynb # Multi-model training, tuning & evaluation
│   ├── src/                               # Modular Python ML Package
│   │   ├── data_loader.py                 # Raw data reader & chronological sorter
│   │   ├── cleaner.py                     # Data sanitization, handling OTC Gold volume
│   │   ├── feature_engineering.py         # SMA, RSI, MACD, ATR, target shifts
│   │   ├── train.py                       # Supervised model training (RF, SVR, baseline)
│   │   ├── evaluate.py                    # Regression & directional accuracy metrics
│   │   └── tune.py                        # TimeSeriesSplit CV & hyperparameter optimization
│   └── saved_models/                      # Serialized artifacts for FastAPI deployment
│       ├── scaler.joblib                  # Fitted feature scaler
│       ├── random_forest.joblib           # Trained model artifact
│       └── model_metadata.json            # Model training metadata & feature list
│
├── docs/                                  # Project Documentation & Viva Defense Assets
│   ├── architecture_overview.md           # Architecture flow (ML -> FastAPI -> Next.js)
│   └── member_contributions.md            # Documented contributions for all 3 members
│
├── .gitignore                             # Git exclusions
└── README.md                              # Main documentation & runbooks
```

---

## 🚀 Quickstart & Setup Guide

### 1. Backend Setup (FastAPI)

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
pip install -r requirements.txt

# 3. Launch the development server
python run.py
# Alternatively: uvicorn app.main:app --reload --port 8000
```
- **FastAPI Root**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`

---

### 2. Frontend Setup (Next.js)

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the Next.js development server
npm run dev
```
- **Trading Analytics Dashboard**: `http://localhost:3000`
- **Technical Indicators Page**: `http://localhost:3000/indicators`
- **Model Diagnostics Page**: `http://localhost:3000/models`

---

### 3. ML Pipeline Execution (Optional Retraining)

```bash
# Run feature engineering pipeline (generates ml/data/processed/XAU_USD_Final_Engineered.csv)
python -m ml.src.feature_engineering

# Train model, evaluate with TimeSeriesSplit, and serialize to ml/saved_models/
python -m ml.src.train
```

---

## 📡 API Endpoint Reference

| Method | Endpoint | Description | Sample Output |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/historical` | Returns recent OHLC price candles for charting | `{"candles": [...]}` |
| `GET` | `/api/v1/indicators` | Returns SMA_14, SMA_50, RSI_14, MACD, ATR_14 | `{"latest": {...}, "data": [...]}` |
| `POST`| `/api/v1/predict` | Predicts next close, trend, confidence & TP/SL | `{"predicted_next_close": 2682.4, "predicted_trend": "BULLISH (UP)"}` |
| `GET` | `/api/v1/predict/latest`| Predicts using latest recorded historical candle | `{"current_close": 2665.0, "predicted_next_close": 2682.4}` |
| `GET` | `/api/v1/signals` | Actionable BUY/SELL signal + ATR TP/SL levels | `{"action": "BUY / LONG", "take_profit_level": 2701.4}` |
| `GET` | `/api/v1/metrics` | Model metrics (RMSE, MAE, R², Directional Acc) | `{"rmse": 14.82, "r2_score": 0.9882, "directional_accuracy_percent": 68.45}` |

---

## 🎓 Academic Defense Highlights (IJSE Viva Voce)

1. **Why was Spot Gold volume omitted?**  
   Spot Gold (XAU/USD) trades on a decentralized Over-The-Counter (OTC) network rather than a single exchange feed. Volume is 100% missing (NaN) across OTC historical sources. Indicators strictly rely on Open, High, Low, and Close.
2. **How is Lookahead Bias prevented in Time-Series ML?**  
   Standard K-Fold Cross Validation leaks future prices into past training folds. We enforce **`TimeSeriesSplit` expanding-window cross-validation**, ensuring the model only trains on past data ($t-n \dots t$) and validates on future data ($t+1$).
3. **What is the rationale behind ATR-based Risk Management?**  
   Instead of arbitrary static dollar stop losses, the system scales Stop Loss ($1.0 \times ATR$) and Take Profit ($2.0 \times ATR$) to current daily volatility, enforcing a strict 1:2 risk-reward ratio.