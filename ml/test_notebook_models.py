import os
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report, confusion_matrix
from sklearn.model_selection import TimeSeriesSplit, cross_val_score

def test_notebook_pipeline():
    print("=" * 60)
    print("XAU/USD MACHINE LEARNING MODEL TEST SUITE")
    print("=" * 60)
    
    notebook_dir = Path(__file__).resolve().parent / "notebooks"
    data_path = notebook_dir / "XAU_USD_Final_Engineered.csv"
    
    if not data_path.exists():
        print(f"[ERROR] Error: Dataset not found at {data_path}")
        return

    # 1. Load Dataset
    df = pd.read_csv(data_path)
    print(f"[OK] Loaded dataset: {len(df)} rows, {len(df.columns)} columns")
    print(f"Columns: {list(df.columns)}")

    # 2. Extract Features & Target
    target_col = 'Target_Trend' if 'Target_Trend' in df.columns else ('Target' if 'Target' in df.columns else None)
    if target_col is None:
        print("[ERROR] Error: Target column missing.")
        return

    y = df[target_col]
    drop_cols = [target_col, 'Target_Next_Close', 'Date', 'Change %']
    drop_cols = [c for c in drop_cols if c in df.columns]
    X = df.drop(columns=drop_cols)

    # Drop non-numeric datetime columns if present
    non_numeric = X.select_dtypes(include=['object']).columns
    if len(non_numeric) > 0:
        X = X.drop(columns=non_numeric)

    print(f"Feature Matrix Shape: {X.shape}, Target Shape: {y.shape}")
    print(f"Features: {list(X.columns)}")
    print(f"Target Distribution: Class 0 (Down) = {(y == 0).sum()}, Class 1 (Up) = {(y == 1).sum()}")

    # 3. Chronological Train/Test Split (80% Train, 20% Test)
    split_idx = int(len(df) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    print(f"Train samples: {len(X_train)} | Test samples: {len(X_test)}")

    # Preprocessing: StandardScaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 4. Model 1: Random Forest Classifier
    rf_model = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_split=10,
        class_weight='balanced',
        random_state=42
    )
    rf_model.fit(X_train, y_train)
    rf_preds = rf_model.predict(X_test)

    rf_acc = accuracy_score(y_test, rf_preds)
    rf_prec = precision_score(y_test, rf_preds, zero_division=0)
    rf_rec = recall_score(y_test, rf_preds, zero_division=0)
    rf_f1 = f1_score(y_test, rf_preds, zero_division=0)

    # 5. Model 2: Support Vector Classifier (SVM)
    svm_model = SVC(
        kernel='rbf',
        C=1.0,
        gamma='scale',
        probability=True,
        class_weight='balanced',
        random_state=42
    )
    svm_model.fit(X_train_scaled, y_train)
    svm_preds = svm_model.predict(X_test_scaled)

    svm_acc = accuracy_score(y_test, svm_preds)
    svm_prec = precision_score(y_test, svm_preds, zero_division=0)
    svm_rec = recall_score(y_test, svm_preds, zero_division=0)
    svm_f1 = f1_score(y_test, svm_preds, zero_division=0)

    # 6. TimeSeries Cross-Validation (5 Folds)
    tscv = TimeSeriesSplit(n_splits=5)
    rf_cv_scores = cross_val_score(rf_model, X, y, cv=tscv, scoring='accuracy')
    svm_cv_scores = cross_val_score(svm_model, StandardScaler().fit_transform(X), y, cv=tscv, scoring='accuracy')

    # 7. Print Comparative Evaluation Table
    results_df = pd.DataFrame({
        'Metric': ['Accuracy', '5-Fold CV Accuracy', 'Precision', 'Recall', 'F1-Score'],
        'Random Forest': [
            f"{rf_acc:.4f}",
            f"{rf_cv_scores.mean():.4f} (±{rf_cv_scores.std():.4f})",
            f"{rf_prec:.4f}",
            f"{rf_rec:.4f}",
            f"{rf_f1:.4f}"
        ],
        'SVM Classifier (RBF)': [
            f"{svm_acc:.4f}",
            f"{svm_cv_scores.mean():.4f} (±{svm_cv_scores.std():.4f})",
            f"{svm_prec:.4f}",
            f"{svm_rec:.4f}",
            f"{svm_f1:.4f}"
        ]
    })

    print("\n" + "=" * 60)
    print("MODEL COMPARISON RESULTS")
    print("=" * 60)
    print(results_df.to_string(index=False))

    print("\n" + "=" * 60)
    print("CONFUSION MATRIX & CLASSIFICATION REPORT (SVM)")
    print("=" * 60)
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, svm_preds))
    print("\nClassification Report:")
    print(classification_report(y_test, svm_preds, target_names=['DOWN (0)', 'UP (1)']))

    # 8. Test Serialized Artifacts Loading
    print("=" * 60)
    print("SERIAILIZED ARTIFACT VERIFICATION (gold_trend_model.pkl & scaler.pkl)")
    print("=" * 60)
    model_path = notebook_dir / "gold_trend_model.pkl"
    scaler_saved_path = notebook_dir / "scaler.pkl"

    if model_path.exists() and scaler_saved_path.exists():
        saved_model = joblib.load(model_path)
        saved_scaler = joblib.load(scaler_saved_path)

        # Build the exact 11 features expected by gold_trend_model.pkl & scaler.pkl
        df_feats = df.copy()
        df_feats['Return_1d'] = df_feats['Close'].pct_change(1)
        df_feats['Return_3d'] = df_feats['Close'].pct_change(3)
        df_feats['Close_Lag1'] = df_feats['Close'].shift(1)
        df_feats['RSI_Lag1'] = df_feats['RSI_14'].shift(1)
        df_feats['Price_Range'] = df_feats['High'] - df_feats['Low']
        
        feature_cols = ['Return_1d', 'Return_3d', 'Close_Lag1', 'RSI_Lag1', 'SMA_14', 'SMA_50', 'RSI_14', 'MACD', 'MACD_Signal', 'ATR_14', 'Price_Range']
        sample_input = df_feats[feature_cols].iloc[-1:].copy()
        
        sample_scaled = saved_scaler.transform(sample_input)
        sample_pred = saved_model.predict(sample_scaled)[0]
        sample_prob = saved_model.predict_proba(sample_scaled)[0]

        direction = "BULLISH (UP)" if sample_pred == 1 else "BEARISH (DOWN)"
        print("[OK] Saved Model successfully loaded & verified!")
        print(f"Sample Last Candle Prediction: {direction}")
        print(f"Class Probabilities: Down (0): {sample_prob[0]:.4f} | Up (1): {sample_prob[1]:.4f}")
    else:
        print("[ERROR] Serialized model or scaler artifact missing.")

if __name__ == "__main__":
    test_notebook_pipeline()
