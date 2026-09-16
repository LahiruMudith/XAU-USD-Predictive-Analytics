"""One shared, causal feature definition for training and live inference."""
import numpy as np
import pandas as pd

FEATURES = ['return_1', 'return_3', 'return_12', 'range_pct', 'body_pct',
            'sma14_gap', 'sma50_gap', 'rsi_scaled', 'macd_pct', 'signal_pct',
            'atr_pct', 'volatility_20', 'hour_sin', 'hour_cos', 'rsi_lag1']
OHLC = ['open', 'high', 'low', 'close']


def clean_candles(frame):
    frame = frame.copy()
    frame['datetime'] = pd.to_datetime(frame['datetime'], utc=True, errors='coerce')
    for name in OHLC:
        frame[name] = pd.to_numeric(frame[name], errors='coerce')
    frame = frame.replace([np.inf, -np.inf], np.nan).dropna(subset=['datetime'] + OHLC)
    valid = (frame[OHLC] > 0).all(axis=1)
    valid &= frame.high >= frame[['open', 'close', 'low']].max(axis=1)
    valid &= frame.low <= frame[['open', 'close', 'high']].min(axis=1)
    # Remove duplicates before sorting so the latest provider revision always wins.
    return frame.loc[valid].drop_duplicates('datetime', keep='last').sort_values('datetime').reset_index(drop=True)


def closed_candles(frame, now=None):
    now = pd.Timestamp.now(tz='UTC') if now is None else pd.Timestamp(now)
    return frame.loc[frame.datetime + pd.Timedelta(minutes=15) <= now].copy()


def engineer(frame):
    f = frame.copy()
    c = f.close
    delta = c.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    f['rsi_14'] = (100 - 100 / (1 + gain / loss.replace(0, np.nan))).where(loss != 0, 100).where((gain != 0) | (loss != 0), 50)
    f['sma_14'] = c.rolling(14).mean()
    f['sma_50'] = c.rolling(50).mean()
    f['sma_20'] = c.rolling(20).mean()
    f['ema_50'] = c.ewm(span=50, adjust=False).mean()
    f['macd'] = c.ewm(span=12, adjust=False).mean() - c.ewm(span=26, adjust=False).mean()
    f['macd_signal'] = f.macd.ewm(span=9, adjust=False).mean()
    tr = pd.concat([f.high - f.low, (f.high - c.shift()).abs(), (f.low - c.shift()).abs()], axis=1).max(axis=1)
    f['atr_14'] = tr.rolling(14).mean()
    f['bb_upper'] = f.sma_20 + 2 * c.rolling(20).std()
    f['bb_lower'] = f.sma_20 - 2 * c.rolling(20).std()
    for period in (1, 3, 12):
        f[f'return_{period}'] = c.pct_change(period, fill_method=None)
    f['range_pct'] = (f.high - f.low) / c
    f['body_pct'] = (c - f.open) / f.open
    f['sma14_gap'] = c / f.sma_14 - 1
    f['sma50_gap'] = c / f.sma_50 - 1
    f['rsi_scaled'] = f.rsi_14 / 100
    f['rsi_lag1'] = f.rsi_scaled.shift()
    f['macd_pct'] = f.macd / c
    f['signal_pct'] = f.macd_signal / c
    f['atr_pct'] = f.atr_14 / c
    f['volatility_20'] = f.return_1.rolling(20).std()
    hour = f.datetime.dt.hour + f.datetime.dt.minute / 60
    f['hour_sin'] = np.sin(2 * np.pi * hour / 24)
    f['hour_cos'] = np.cos(2 * np.pi * hour / 24)
    return f.replace([np.inf, -np.inf], np.nan)


def training_rows(frame):
    f = engineer(closed_candles(clean_candles(frame)))
    # Exclude weekends, market breaks, missing next bars and unchanged closes.
    consecutive = f.datetime.shift(-1) - f.datetime == pd.Timedelta(minutes=15)
    changed = f.close.shift(-1) != f.close
    f['target'] = (f.close.shift(-1) > f.close).astype(int)
    f['target_time'] = f.datetime.shift(-1) + pd.Timedelta(minutes=15)
    return f.loc[consecutive & changed].dropna(subset=FEATURES + ['target_time']).reset_index(drop=True)
