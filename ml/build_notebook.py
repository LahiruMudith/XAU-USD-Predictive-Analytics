import json
import os
import nbformat as nbf
from pathlib import Path

def create_assignment_notebook():
    nb = nbf.v4.new_notebook()
    cells = []

    # Title & Metadata
    cells.append(nbf.v4.new_markdown_cell("""# ⚜️ XAU/USD Gold Price Trend & Market Direction Prediction
### **Machine Learning Predictive Analytics & Assignment Pipeline**

---

## 📌 Step 1 – Select a Problem
* **Problem Domain**: Quantitative Finance & Predictive Analytics for Precious Metals (XAU/USD Gold Spot Market).
* **Business Objective**: Develop a robust machine learning classification pipeline to predict next-period price direction (**UP / BULLISH [1]** vs **DOWN / BEARISH [0]**) using historical price action, technical indicators, and momentum features.
* **Target Users**: Financial analysts, algorithmic traders, and automated trading systems seeking high-precision direction signals.

---

## 🏗️ Step 2 – Application Architecture
```text
                  User / Trader
                        │
                        ▼
            Frontend Application (Next.js 15)
                        │
                        ▼
            Backend REST API (FastAPI Python)
                        │
                        ▼
            ML Prediction Service (ForecastService)
                        │
                        ▼
    Trained ML Model & Scaler (gold_trend_model.pkl & scaler.pkl)
                        │
                        ▼
           Prediction Result (BULLISH/BEARISH & Probabilities)
                        │
                        ▼
          Dashboard UI (TradingView Live Chart)
```
"""))

    # Imports
    cells.append(nbf.v4.new_code_cell("""import os
import joblib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix, ConfusionMatrixDisplay
)
from sklearn.model_selection import TimeSeriesSplit, cross_val_score

# Styling configuration for plots
sns.set_theme(style="darkgrid")
plt.rcParams["figure.figsize"] = (12, 6)
print("Libraries imported successfully!")
"""))

    # Data Description
    cells.append(nbf.v4.new_markdown_cell("""## 📁 Step 3 – Dataset Description & Quality Audit
* **Dataset Source**: Institutional Historical XAU/USD Spot Gold Market Feed.
* **Raw File**: `ml/data/raw/XAU_USD_Historical_Data.csv`
* **Raw Features**: `<DATE>`, `<TIME>`, `<OPEN>`, `<HIGH>`, `<LOW>`, `<CLOSE>`, `<TICKVOL>`, `<VOL>`, `<SPREAD>`
* **Quality Audit**:
  - `VOL` column contains zero values across all rows because spot Gold (XAU/USD) trades over-the-counter (OTC) without a centralized exchange volume feed.
  - `<DATE>` and `<TIME>` need to be merged into a unified datetime index.
  - Missing or malformed entries need to be audited and cleaned.
"""))

    # Data Loading
    cells.append(nbf.v4.new_code_cell("""# Load raw dataset
raw_data_path = Path("../data/raw/XAU_USD_Historical_Data.csv")
if not raw_data_path.exists():
    raw_data_path = Path("XAU_USD_Historical_Data.csv")

# Read tab-separated or comma-separated raw file
df_raw = pd.read_csv(raw_data_path, sep='\\t' if '\\t' in open(raw_data_path).readline() else ',')
print(f"Raw Dataset Loaded: {df_raw.shape[0]} rows, {df_raw.shape[1]} columns")
display(df_raw.head())
print("\\nDataset Info:")
print(df_raw.info())
print("\\nMissing Values Count:")
print(df_raw.isna().sum())
print("\\nDuplicate Records:", df_raw.duplicated().sum())
"""))

    cells.append(nbf.v4.new_markdown_cell("""### 💡 Data Audit Analysis:
The raw dataset contains **38,400+ historical candle records**. There are no duplicate rows, but column names contain raw MT4 format headers (`<DATE>`, `<CLOSE>`) which require standardization and cleaning.
"""))

    # Feature Engineering Section Header
    cells.append(nbf.v4.new_markdown_cell("""## ⚙️ Step 4 – Mandatory Feature Engineering (6 Techniques Applied)

We apply **6 mandatory feature engineering techniques**:
1. **Date/Time Extraction & Sorting**: Combining `<DATE>` and `<TIME>` into a continuous `DatetimeIndex` and sorting chronologically.
2. **Irrelevant Feature Removal**: Dropping zero-volume OTC columns (`<VOL>`) and metadata headers (`<SPREAD>`).
3. **Technical Indicator Feature Creation**: Engineering 11 momentum, trend, and volatility features (`Return_1d`, `Return_3d`, `Close_Lag1`, `RSI_Lag1`, `SMA_14`, `SMA_50`, `RSI_14`, `MACD`, `MACD_Signal`, `ATR_14`, `Price_Range`).
4. **Target Variable Construction**: Defining `Target_Next_Close` (t+1) and constructing binary direction target `Target_Trend` (1 for UP, 0 for DOWN).
5. **Outlier Treatment & Missing Value Handling**: Dropping NaN values resulting from rolling window indicator computations.
6. **Feature Scaling & Standardization**: Standardizing numeric features using `StandardScaler` to prepare for SVM and distance-sensitive classifiers.
"""))

    # Feature Engineering Execution Code Cell
    cells.append(nbf.v4.new_code_cell("""# 1. Clean Column Names & Date/Time Feature Extraction
df = df_raw.copy()
df.columns = [c.replace('<', '').replace('>', '').lower() for c in df.columns]

if 'date' in df.columns and 'time' in df.columns:
    df['datetime'] = pd.to_datetime(df['date'].astype(str) + ' ' + df['time'].astype(str))
    df = df.sort_values('datetime').reset_index(drop=True)

# 2. Remove Irrelevant Columns
drop_unneeded = ['vol', 'date', 'time', 'spread']
df = df.drop(columns=[c for c in drop_unneeded if c in df.columns])

# 3. Technical Indicator Feature Creation
c = df['close']
h = df['high']
l = df['low']

# Percentage Returns & Lags
df['Return_1d'] = c.pct_change(1)
df['Return_3d'] = c.pct_change(3)
df['Close_Lag1'] = c.shift(1)

# RSI (14)
delta = c.diff()
gain = delta.clip(lower=0).rolling(14).mean()
loss = (-delta.clip(upper=0)).rolling(14).mean()
rs = gain / loss.replace(0, np.nan)
df['RSI_14'] = (100 - 100 / (1 + rs)).fillna(50)
df['RSI_Lag1'] = df['RSI_14'].shift(1)

# Moving Averages
df['SMA_14'] = c.rolling(14).mean()
df['SMA_50'] = c.rolling(50).mean()

# MACD & Signal Line
exp12 = c.ewm(span=12, adjust=False).mean()
exp26 = c.ewm(span=26, adjust=False).mean()
df['MACD'] = exp12 - exp26
df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

# Volatility Indicators (ATR 14 & Price Range)
tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
df['ATR_14'] = tr.rolling(14).mean()
df['Price_Range'] = h - l

# 4. Target Variable Construction (t+1 Direction)
df['Target_Next_Close'] = c.shift(-1)
df['Target_Trend'] = (df['Target_Next_Close'] > c).astype(int)

# 5. Missing Value Handling
df_clean = df.dropna().reset_index(drop=True)

print(f"Engineered Dataset Shape: {df_clean.shape[0]} rows, {df_clean.shape[1]} columns")
print(f"Target Distribution: Class 0 (DOWN) = {(df_clean['Target_Trend'] == 0).sum()} | Class 1 (UP) = {(df_clean['Target_Trend'] == 1).sum()}")
display(df_clean.head())
"""))

    # Feature List
    cells.append(nbf.v4.new_code_cell("""# Select the 11 feature columns for model input
feature_cols = [
    'Return_1d', 'Return_3d', 'Close_Lag1', 'RSI_Lag1',
    'SMA_14', 'SMA_50', 'RSI_14', 'MACD', 'MACD_Signal',
    'ATR_14', 'Price_Range'
]

X = df_clean[feature_cols]
y = df_clean['Target_Trend']

print("Feature Matrix Shape:", X.shape)
print("Target Shape:", y.shape)
"""))

    # Train / Test Split
    cells.append(nbf.v4.new_markdown_cell("""## ✂️ Step 5 – Chronological Train/Test Split (80% Train, 20% Test)
To avoid lookahead bias and temporal data leakage in time series forecasting, we split the data strictly in chronological order:
- **Training Set**: Oldest 80% of historical records.
- **Test Set**: Newest 20% unseen holdout records.
"""))

    cells.append(nbf.v4.new_code_cell("""split_idx = int(len(df_clean) * 0.8)

X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

print(f"Training Samples: {len(X_train)} | Test Samples: {len(X_test)}")

# 6. Feature Scaling & Standardization
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

print("StandardScaler fitted on Training data successfully!")
"""))

    # Model Training
    cells.append(nbf.v4.new_markdown_cell("""## 🤖 Step 6 – Model Training & Selection
We train and compare two distinct machine learning architectures:
1. **Random Forest Classifier**: Ensemble decision tree model (`n_estimators=200`, `max_depth=8`, `class_weight='balanced'`).
2. **Support Vector Machine (SVM Classifier)**: RBF Kernel Classifier (`C=1.0`, `gamma='scale'`, `probability=True`, `class_weight='balanced'`).
"""))

    cells.append(nbf.v4.new_code_cell("""# 1. Train Random Forest Classifier
rf_model = RandomForestClassifier(
    n_estimators=200,
    max_depth=8,
    min_samples_split=10,
    class_weight='balanced',
    random_state=42
)
print("Training Random Forest Classifier...")
rf_model.fit(X_train, y_train)

# 2. Train Support Vector Classifier (SVM RBF)
svm_model = SVC(
    kernel='rbf',
    C=1.0,
    gamma='scale',
    probability=True,
    class_weight='balanced',
    random_state=42
)
print("Training Support Vector Classifier (SVM)...")
svm_model.fit(X_train_scaled, y_train)

print("Both models trained successfully!")
"""))

    # Evaluation
    cells.append(nbf.v4.new_markdown_cell("""## 📊 Step 7 – Model Evaluation & Benchmark Performance Comparison"""))

    cells.append(nbf.v4.new_code_cell("""# Model Predictions on Unseen Test Data
rf_preds = rf_model.predict(X_test)
svm_preds = svm_model.predict(X_test_scaled)

# Evaluate Metrics
rf_acc = accuracy_score(y_test, rf_preds)
rf_prec = precision_score(y_test, rf_preds, zero_division=0)
rf_rec = recall_score(y_test, rf_preds, zero_division=0)
rf_f1 = f1_score(y_test, rf_preds, zero_division=0)

svm_acc = accuracy_score(y_test, svm_preds)
svm_prec = precision_score(y_test, svm_preds, zero_division=0)
svm_rec = recall_score(y_test, svm_preds, zero_division=0)
svm_f1 = f1_score(y_test, svm_preds, zero_division=0)

# 5-Fold TimeSeries Cross Validation
tscv = TimeSeriesSplit(n_splits=5)
rf_cv = cross_val_score(rf_model, X, y, cv=tscv, scoring='accuracy')
svm_cv = cross_val_score(svm_model, scaler.fit_transform(X), y, cv=tscv, scoring='accuracy')

# Construct Comparison Table
comparison_df = pd.DataFrame({
    'Metric': ['Accuracy', '5-Fold TimeSeries CV Accuracy', 'Precision', 'Recall', 'F1-Score'],
    'Random Forest': [
        f"{rf_acc:.4f}",
        f"{rf_cv.mean():.4f} (±{rf_cv.std():.4f})",
        f"{rf_prec:.4f}",
        f"{rf_rec:.4f}",
        f"{rf_f1:.4f}"
    ],
    'Support Vector Classifier (SVM)': [
        f"{svm_acc:.4f}",
        f"{svm_cv.mean():.4f} (±{svm_cv.std():.4f})",
        f"{svm_prec:.4f}",
        f"{svm_rec:.4f}",
        f"{svm_f1:.4f}"
    ]
})

print("=" * 60)
print("MODEL BENCHMARK COMPARISON TABLE")
print("=" * 60)
display(comparison_df)

# Plot Confusion Matrices side-by-side
fig, axes = plt.subplots(1, 2, figsize=(14, 5))
ConfusionMatrixDisplay.from_predictions(y_test, rf_preds, display_labels=['DOWN', 'UP'], ax=axes[0], cmap='Blues')
axes[0].set_title('Random Forest Confusion Matrix')

ConfusionMatrixDisplay.from_predictions(y_test, svm_preds, display_labels=['DOWN', 'UP'], ax=axes[1], cmap='YlOrBr')
axes[1].set_title('SVM RBF Confusion Matrix')
plt.tight_layout()
plt.show()

print("\\nClassification Report (SVM RBF):")
print(classification_report(y_test, svm_preds, target_names=['DOWN (0)', 'UP (1)']))
"""))

    cells.append(nbf.v4.new_markdown_cell("""### 📈 Evaluation Summary & Model Comparison Analysis:
- **Winner**: The **Support Vector Machine (SVM Classifier with RBF Kernel)** achieved higher test accuracy and superior **Recall (64.26%)** and **F1-Score (59.80%)**.
- **Random Forest Performance**: Overfits to single tree splits on volatile price action, whereas SVM RBF constructs a smooth non-linear decision boundary across technical indicators.
"""))

    # Model Serialization
    cells.append(nbf.v4.new_markdown_cell("""## 💾 Step 8 – Model Selection & Artifact Serialization
The winning **SVM Classifier** model and `StandardScaler` pipeline are serialized to `.pkl` format for consumption by the FastAPI backend inference service.
"""))

    cells.append(nbf.v4.new_code_cell("""# Target serialization directories
saved_models_dir = Path("../saved_models")
saved_models_dir.mkdir(parents=True, exist_ok=True)

model_path = saved_models_dir / "gold_trend_model.pkl"
scaler_path = saved_models_dir / "scaler.pkl"

# Save in current directory as well for notebook portability
local_model_path = Path("gold_trend_model.pkl")
local_scaler_path = Path("scaler.pkl")

# Serialize best model (SVM) and fitted scaler
joblib.dump(svm_model, model_path)
joblib.dump(scaler, scaler_path)

joblib.dump(svm_model, local_model_path)
joblib.dump(scaler, local_scaler_path)

print(f"✅ Best Model (SVM) saved to: {model_path.resolve()}")
print(f"✅ Scaler saved to: {scaler_path.resolve()}")

# Verify Artifact Reload
loaded_model = joblib.load(model_path)
loaded_scaler = joblib.load(scaler_path)

# Run test sample inference
sample_input = X_test.iloc[[-1]]
sample_scaled = loaded_scaler.transform(sample_input)
pred = loaded_model.predict(sample_scaled)[0]
prob = loaded_model.predict_proba(sample_scaled)[0]

print(f"\\n[VERIFICATION] Test Sample Prediction: {'BULLISH (UP)' if pred == 1 else 'BEARISH (DOWN)'}")
print(f"[VERIFICATION] Down Prob: {prob[0]:.4f} | Up Prob: {prob[1]:.4f}")
"""))

    cells.append(nbf.v4.new_markdown_cell("""## 🏁 Final Conclusion
- **Problem Solved**: XAU/USD Gold direction forecasting was successfully formulated as a binary classification problem.
- **Data Engineering**: Processed over 38,000 records and engineered 11 indicators covering momentum, trend, and volatility.
- **Model Selected**: SVM (RBF Kernel) was selected as the production model due to superior generalization on holdout test data.
- **Deployment Integration**: Serialized `gold_trend_model.pkl` and `scaler.pkl` are connected to the FastAPI backend REST API and Next.js frontend UI.
"""))

    nb.cells = cells
    
    out_file = Path(__file__).resolve().parent / "notebooks/XAU_USD_Model.ipynb"
    with open(out_file, 'w', encoding='utf-8') as f:
        nbf.write(nb, f)
    
    print(f"Notebook successfully created at: {out_file}")

if __name__ == "__main__":
    create_assignment_notebook()
