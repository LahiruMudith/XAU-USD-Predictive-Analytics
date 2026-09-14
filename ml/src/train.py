import json
from pathlib import Path
from typing import Optional
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from ml.src.evaluate import calculate_regression_metrics, calculate_directional_accuracy

FEATURE_COLUMNS = ['Open', 'High', 'Low', 'Close', 'SMA_14', 'SMA_50', 'RSI_14', 'MACD', 'MACD_Signal', 'ATR_14']
TARGET_COLUMN = 'Target_Next_Close'

def train_and_save_pipeline(data_path: Optional[str] = None, output_dir: Optional[str] = None):
    base_dir = Path(__file__).resolve().parent.parent
    if data_path is None:
        data_path = base_dir / 'data' / 'processed' / 'XAU_USD_Final_Engineered.csv'
        if not Path(data_path).exists():
            from ml.src.feature_engineering import prepare_and_save_dataset
            prepare_and_save_dataset()
    if output_dir is None:
        output_dir = base_dir / 'saved_models'
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(data_path)
    X = df[FEATURE_COLUMNS].values
    y = df[TARGET_COLUMN].values
    current_closes = df['Close'].values
    split_idx = int(len(df) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    closes_test = current_closes[split_idx:]
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    model.fit(X_train_scaled, y_train)
    y_pred = model.predict(X_test_scaled)
    metrics = calculate_regression_metrics(y_test, y_pred)
    metrics['directional_accuracy_percent'] = calculate_directional_accuracy(y_test, y_pred, closes_test)
    importances = dict(zip(FEATURE_COLUMNS, [round(float(v), 4) for v in model.feature_importances_]))
    joblib.dump(scaler, output_dir / 'scaler.joblib')
    joblib.dump(model, output_dir / 'random_forest.joblib')
    metadata = {
        'model_type': 'RandomForestRegressor',
        'feature_columns': FEATURE_COLUMNS,
        'target_column': TARGET_COLUMN,
        'train_samples': len(X_train),
        'test_samples': len(X_test),
        'metrics': metrics,
        'feature_importances': importances
    }
    with open(output_dir / 'model_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f'Trained and evaluated! Metrics: {metrics}')
    return metadata

if __name__ == '__main__':
    train_and_save_pipeline()
