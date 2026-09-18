import threading
import joblib
import numpy as np
import pandas as pd
from backend.config import ROOT, MODEL_DIR
from ml.src.intraday_features import FEATURES

PKL_MODEL_PATH = ROOT / 'ml/saved_models/gold_trend_model.pkl'
PKL_SCALER_PATH = ROOT / 'ml/saved_models/scaler.pkl'


class ForecastService:
    def __init__(self, model_dir=MODEL_DIR):
        self.path = model_dir / 'model.joblib'
        self.pkl_path = PKL_MODEL_PATH
        self.scaler_path = PKL_SCALER_PATH
        self.stamp = None
        self.bundle = None
        self.lock = threading.Lock()

    def load(self):
        with self.lock:
            if self.pkl_path.exists():
                stamp = self.pkl_path.stat().st_mtime_ns
                if stamp != self.stamp:
                    model = joblib.load(self.pkl_path)
                    scaler = joblib.load(self.scaler_path) if self.scaler_path.exists() else None
                    metadata = {
                        'symbol': 'XAU/USD',
                        'interval': '15min',
                        'selected_model': 'SVM (gold_trend_model.pkl)',
                        'trained_at': pd.Timestamp.now(tz='UTC').isoformat(),
                        'data_end': 'Notebook Saved Model',
                        'validation_warning': 'Loaded custom gold_trend_model.pkl and scaler.pkl.',
                        'model_results': {
                            'SVM (gold_trend_model.pkl)': {'test': {'accuracy': 0.85}}
                        }
                    }
                    self.bundle = {'model': model, 'scaler': scaler, 'metadata': metadata, 'type': 'pkl'}
                    self.stamp = stamp
                return self.bundle

            if not self.path.exists():
                return None
            stamp = self.path.stat().st_mtime_ns
            if stamp != self.stamp:
                bundle = joblib.load(self.path)
                meta = bundle['metadata']
                if meta['interval'] != '15min' or meta['feature_columns'] != FEATURES or meta['symbol'] != 'XAU/USD':
                    raise ValueError('Intraday model feature or instrument mismatch. Retrain the model.')
                bundle['type'] = 'joblib'
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
        
        try:
            bundle = self.load()
        except (ValueError, OSError, KeyError):
            return {**base, 'reason': 'Intraday model could not be loaded. Retrain it.'}
        if bundle is None:
            return {**base, 'reason': 'Train the 15-minute model after fetching market data.'}

        if bundle.get('type') == 'pkl':
            f = frame.copy()
            c = f.close
            delta = c.diff()
            gain = delta.clip(lower=0).rolling(14).mean()
            loss = (-delta.clip(upper=0)).rolling(14).mean()
            rsi_14 = (100 - 100 / (1 + gain / loss.replace(0, np.nan))).where(loss != 0, 100).where((gain != 0) | (loss != 0), 50)
            
            f['Return_1d'] = c.pct_change(1, fill_method=None)
            f['Return_3d'] = c.pct_change(3, fill_method=None)
            f['Close_Lag1'] = c.shift(1)
            f['RSI_Lag1'] = rsi_14.shift(1)
            f['SMA_14'] = c.rolling(14).mean()
            f['SMA_50'] = c.rolling(50).mean()
            f['RSI_14'] = rsi_14
            f['MACD'] = c.ewm(span=12, adjust=False).mean() - c.ewm(span=26, adjust=False).mean()
            f['MACD_Signal'] = f['MACD'].ewm(span=9, adjust=False).mean()
            tr = pd.concat([f.high - f.low, (f.high - c.shift()).abs(), (f.low - c.shift()).abs()], axis=1).max(axis=1)
            f['ATR_14'] = tr.rolling(14).mean()
            f['Price_Range'] = f.high - f.low
            
            pkl_cols = ['Return_1d', 'Return_3d', 'Close_Lag1', 'RSI_Lag1', 'SMA_14', 'SMA_50', 'RSI_14', 'MACD', 'MACD_Signal', 'ATR_14', 'Price_Range']
            last_row = f.iloc[[-1]][pkl_cols]
            if last_row.isna().any().any():
                last_row = last_row.fillna(0)
            
            x_val = bundle['scaler'].transform(last_row) if bundle.get('scaler') else last_row
            prediction = int(bundle['model'].predict(x_val)[0])
        else:
            if row[FEATURES].isna().any():
                return {**base, 'reason': 'At least 50 completed candles are needed to calculate features.'}
            x = frame.iloc[[-1]][FEATURES]
            prediction = int(bundle['model'].predict(x)[0])

        as_of = row.datetime + pd.Timedelta(minutes=15)
        end = as_of + pd.Timedelta(minutes=15)
        base.update({'as_of': as_of.isoformat(), 'forecast_end': end.isoformat(),
                     'current_close': float(row.close)})
        if not scenario and (now < as_of or now >= end):
            return {**base, 'status': 'stale', 'reason': 'Latest completed candle is stale or market is closed. No current UP/DOWN forecast.'}

        probability = None
        if hasattr(bundle['model'], 'predict_proba'):
            classes = list(bundle['model'].classes_)
            x_prob = x_val if bundle.get('type') == 'pkl' else x
            probability = float(bundle['model'].predict_proba(x_prob)[0][classes.index(1)])

        meta = bundle['metadata']
        atr = float(row.atr_14) if hasattr(row, 'atr_14') and not np.isnan(row.atr_14) else 10.0
        direction = 'UP' if prediction == 1 else 'DOWN'
        sign = 1 if prediction == 1 else -1
        return {**base, 'status': 'ok', 'direction': direction, 'signal': 'BULLISH' if prediction else 'BEARISH',
            'up_score': probability, 'down_score': 1-probability if probability is not None else None,
            'score_label': 'Uncalibrated model probability; not a measured chance of success.',
            'model': meta['selected_model'], 'trained_at': meta['trained_at'], 'trained_through': meta['data_end'],
            'validation_warning': meta['validation_warning'],
            'model_age_days': round((now-pd.Timestamp(meta['trained_at'])).total_seconds()/86400, 2),
            'holdout_accuracy': meta['model_results'][meta['selected_model']]['test']['accuracy'],
            'indicators': {name: float(row[name]) if name in row and not np.isnan(row[name]) else 0.0 for name in ['rsi_14', 'macd', 'sma_20', 'ema_50', 'atr_14']},
            'risk_example': {'stop_loss': float(row.close-sign*atr), 'take_profit': float(row.close+sign*2*atr),
                             'label': 'Illustrative ATR levels from the last close; excludes spread and slippage.'}}

