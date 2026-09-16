import threading
import joblib
import numpy as np
import pandas as pd
from backend.config import MODEL_DIR
from ml.src.intraday_features import FEATURES


class ForecastService:
    def __init__(self, model_dir=MODEL_DIR):
        self.path = model_dir / 'model.joblib'
        self.stamp = None
        self.bundle = None
        self.lock = threading.Lock()

    def load(self):
        with self.lock:
            if not self.path.exists():
                return None
            stamp = self.path.stat().st_mtime_ns
            if stamp != self.stamp:
                bundle = joblib.load(self.path)
                meta = bundle['metadata']
                if meta['interval'] != '15min' or meta['feature_columns'] != FEATURES or meta['symbol'] != 'XAU/USD':
                    raise ValueError('Intraday model feature or instrument mismatch. Retrain the model.')
                self.bundle, self.stamp = bundle, stamp
            return self.bundle

    def predict(self, frame, market, now=None, scenario=False):
        now = pd.Timestamp.now(tz='UTC') if now is None else pd.Timestamp(now)
        base = {'status': 'unavailable', 'direction': None, 'horizon_minutes': 15,
                'generated_at': now.isoformat(), 'market': market, 'scenario': scenario}
        if market['interval'] != '15min':
            return {**base, 'reason': '15-minute market data is unavailable. The daily archive cannot produce a 15-minute forecast.'}
        if frame.empty:
            return {**base, 'reason': 'Waiting for a completed 15-minute candle.'}
        row = frame.iloc[-1]
        if row[FEATURES].isna().any():
            return {**base, 'reason': 'At least 50 completed candles are needed to calculate features.'}
        as_of = row.datetime + pd.Timedelta(minutes=15)
        end = as_of + pd.Timedelta(minutes=15)
        base.update({'as_of': as_of.isoformat(), 'forecast_end': end.isoformat(),
                     'current_close': float(row.close)})
        if not scenario and (now < as_of or now >= end):
            return {**base, 'status': 'stale', 'reason': 'Latest completed candle is stale or market is closed. No current UP/DOWN forecast.'}
        try:
            bundle = self.load()
        except (ValueError, OSError, KeyError):
            return {**base, 'reason': 'Intraday model could not be loaded. Retrain it.'}
        if bundle is None:
            return {**base, 'reason': 'Train the 15-minute model after fetching market data.'}
        x = frame.iloc[[-1]][FEATURES]
        prediction = int(bundle['model'].predict(x)[0])
        probability = None
        if hasattr(bundle['model'], 'predict_proba'):
            classes = list(bundle['model'].classes_)
            probability = float(bundle['model'].predict_proba(x)[0][classes.index(1)])
        meta = bundle['metadata']
        atr = float(row.atr_14)
        direction = 'UP' if prediction == 1 else 'DOWN'
        sign = 1 if prediction == 1 else -1
        return {**base, 'status': 'ok', 'direction': direction, 'signal': 'BULLISH' if prediction else 'BEARISH',
            'up_score': probability, 'down_score': 1-probability if probability is not None else None,
            'score_label': 'Uncalibrated model probability; not a measured chance of success.',
            'model': meta['selected_model'], 'trained_at': meta['trained_at'], 'trained_through': meta['data_end'],
            'validation_warning': meta['validation_warning'],
            'model_age_days': round((now-pd.Timestamp(meta['trained_at'])).total_seconds()/86400, 2),
            'holdout_accuracy': meta['model_results'][meta['selected_model']]['test']['accuracy'],
            'indicators': {name: float(row[name]) for name in ['rsi_14', 'macd', 'sma_20', 'ema_50', 'atr_14']},
            'risk_example': {'stop_loss': float(row.close-sign*atr), 'take_profit': float(row.close+sign*2*atr),
                             'label': 'Illustrative ATR levels from the last close; excludes spread and slippage.'}}
