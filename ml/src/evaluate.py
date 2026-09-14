from typing import Dict
import numpy as np

def calculate_regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    mae = float(np.mean(np.abs(y_true - y_pred)))
    mse = float(np.mean((y_true - y_pred) ** 2))
    rmse = float(np.sqrt(mse))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    r2 = float(1.0 - (ss_res / ss_tot)) if ss_tot != 0 else 0.0
    mape = float(np.mean(np.abs((y_true - y_pred) / y_true))) * 100.0
    return {
        'rmse': round(rmse, 4),
        'mae': round(mae, 4),
        'r2_score': round(r2, 4),
        'mape_percent': round(mape, 4)
    }

def calculate_directional_accuracy(y_true_close: np.ndarray, y_pred_close: np.ndarray, y_current_close: np.ndarray) -> float:
    actual_direction = (np.array(y_true_close) > np.array(y_current_close)).astype(int)
    predicted_direction = (np.array(y_pred_close) > np.array(y_current_close)).astype(int)
    correct = np.sum(actual_direction == predicted_direction)
    total = len(actual_direction)
    return round(float(correct / total * 100.0), 2) if total > 0 else 0.0
