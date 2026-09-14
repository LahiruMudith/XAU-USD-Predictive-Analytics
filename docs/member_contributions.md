# 3-Member Contribution & Viva Voce Defense Guide

## Overview
This document specifies individual responsibilities and contribution areas for the **3 team members** on the **XAU/USD Predictive Analytics** project. Use this document as an official reference for the IJSE 4th Semester Machine Learning project report and Viva Voce defense.

---

## Member 1: Data Engineering & Feature Extraction Specialist

### Primary Responsibilities
1. **Raw Ingestion & Preprocessing**:
   - Addressed Spot Gold OTC market nuances (dropping 100% NaN `Vol.` column because Spot Gold operates on decentralized OTC networks without central volume ticker feeds).
   - Corrected reverse-chronological ordering from historical feeds to sequential time-series ordering.
   - Cleaned formatted string prices with comma separators into floating point representations.
2. **Technical Feature Engineering**:
   - Trend Indicators: Simple Moving Averages ($SMA_{14}$, $SMA_{50}$).
   - Momentum Indicators: Relative Strength Index ($RSI_{14}$).
   - Trend Momentum: Moving Average Convergence Divergence ($MACD$ 12, 26, Signal 9).
   - Volatility Indicators: Average True Range ($ATR_{14}$) used for dynamic volatility scaling and risk bounds.
3. **Supervised Target Creation**:
   - `Target_Next_Close`: Shifted next-day closing price for regression.
   - `Target_Trend`: Binary directional label (1 if $Close_{t+1} > Close_t$, 0 otherwise).
4. **Deliverables in Codebase**:
   - `ml/src/data_loader.py`
   - `ml/src/cleaner.py`
   - `ml/src/feature_engineering.py`
   - `ml/notebooks/01_data_exploration.ipynb`
   - `ml/notebooks/02_feature_engineering.ipynb`

### Key Viva Talking Points
- *Why was Volume dropped?* Spot Gold (XAU/USD) is traded OTC (Over-the-Counter), meaning centralized volume is unavailable, unlike exchange-traded equity stocks.
- *How were technical indicators prevented from lookahead bias?* All moving windows and indicators strictly use past rolling windows ($t-n$ to $t$) and targets use $t+1$ shifts.

---

## Member 2: Machine Learning Modeling & Evaluation Specialist

### Primary Responsibilities
1. **Model Selection & Architecture**:
   - Baseline Models: Linear Regression / Ridge.
   - Ensemble Models: Random Forest Regressor & Classifier.
   - Non-linear Support Vector Regression (SVR).
2. **Cross-Validation & Hyperparameter Tuning**:
   - Implemented `TimeSeriesSplit` cross-validation to prevent time-travel data leakage (expanding window cross-validation).
   - Grid search optimization for tree depth, estimator counts, and regularization parameters.
3. **Model Evaluation & Diagnostics**:
   - Regression Metrics: Root Mean Squared Error ($RMSE$), Mean Absolute Error ($MAE$), Coefficient of Determination ($R^2$), Mean Absolute Percentage Error ($MAPE$).
   - Directional Classification: Trend Accuracy Percentage ($Accuracy = \frac{TP + TN}{Total}$).
   - Feature Importance analysis validating the predictive power of $SMA$, $RSI$, and $ATR$.
4. **Deliverables in Codebase**:
   - `ml/src/train.py`
   - `ml/src/tune.py`
   - `ml/src/evaluate.py`
   - `ml/saved_models/random_forest.joblib`
   - `ml/saved_models/scaler.joblib`
   - `ml/notebooks/03_model_training_evaluation.ipynb`

### Key Viva Talking Points
- *Why is standard K-Fold CV inappropriate for this dataset?* Financial price time series have strong temporal autocorrelation. Random K-fold causes future data to leak into past folds. `TimeSeriesSplit` preserves chronological integrity.
- *Which features contributed the highest importance?* Short-term price momentum ($SMA_{14}$, $RSI_{14}$) and volatility ($ATR_{14}$) showed high Gini / MDI importance.

---

## Member 3: Full-Stack Integration Specialist (FastAPI & Next.js)

### Primary Responsibilities
1. **FastAPI Backend Architecture**:
   - Structured modular REST API with asynchronous FastAPI framework and Pydantic validation schemas.
   - Implemented `/api/v1/predict`, `/api/v1/indicators`, `/api/v1/historical`, `/api/v1/signals`, and `/api/v1/metrics`.
   - Built the runtime `model_service.py` that deserializes saved `.joblib` models to deliver low-latency inferences.
   - Designed ATR-based Take Profit / Stop Loss logic mapping market volatility to recommended risk-reward ratios (1:2).
2. **Next.js Frontend Development**:
   - Built a sleek, modern, dark-themed financial trading analytics dashboard in Next.js (App Router) + TypeScript.
   - Interactive candlestick/line chart components visualizing historical prices, SMA overlays, and indicator signals.
   - Real-time prediction card with confidence indicator and directional badge.
   - Model metrics page comparing $RMSE$, $MAE$, $R^2$, and confusion metrics.
3. **Deliverables in Codebase**:
   - `backend/app/main.py`
   - `backend/app/api/v1/endpoints/`
   - `backend/app/services/`
   - `backend/app/schemas/`
   - `frontend/src/app/`
   - `frontend/src/components/`
   - `frontend/src/services/api.ts`

### Key Viva Talking Points
- *How does the frontend communicate with the ML model?* The Next.js frontend calls the FastAPI asynchronous REST endpoints. FastAPI feeds the input vector through the serialized `StandardScaler` and `RandomForest` model and returns the prediction in JSON.
- *How does the ATR-based Risk Management work?* The backend calculates $ATR_{14}$ volatility. When an UP trend is predicted, Stop Loss is set to $Close - (1.5 \times ATR)$ and Take Profit is set to $Close + (3.0 \times ATR)$, enforcing a disciplined 1:2 risk-to-reward ratio.
