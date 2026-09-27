import importlib
import pytest
import numpy as np
import pandas as pd
from backend.services.forecast_service import ForecastService
from backend.ml.feature_engineering import clean_candles, engineer, training_rows

api_module = importlib.import_module('backend.app')



@pytest.fixture
def candles():
    rng = np.random.default_rng(42)
    stamps = pd.date_range('2026-09-01', periods=1000, freq='15min', tz='UTC')
    close = 2500.0 + np.cumsum(rng.normal(0, 1.5, len(stamps)))
    open_p = close + rng.normal(0, 0.5, len(stamps))
    high = np.maximum(open_p, close) + rng.uniform(0.1, 2.0, len(stamps))
    low = np.minimum(open_p, close) - rng.uniform(0.1, 2.0, len(stamps))
    return pd.DataFrame({'datetime': stamps, 'open': open_p, 'high': high, 'low': low, 'close': close})


def test_causal_features(candles):
    eng = engineer(candles)
    row = eng.iloc[100]
    sub = engineer(candles.iloc[:101])
    assert abs(row.rsi_14 - sub.iloc[-1].rsi_14) < 1e-9


def test_clean_candles_and_gaps(candles):
    dirty = pd.concat([candles, pd.DataFrame([{'datetime': 'bad', 'open': 1, 'high': 1, 'low': 1, 'close': 1}])], ignore_index=True)
    cleaned = clean_candles(dirty)
    assert len(cleaned) == len(candles)
    rows = training_rows(cleaned)
    assert 'target' in rows.columns and 'target_time' in rows.columns


def test_forecast_expiry(candles):
    service = ForecastService()
    eng = engineer(candles)
    expired = service.predict(eng, {'interval': '15min'}, now='2026-09-10T00:00:00+00:00')
    assert expired['status'] in ('stale', 'ok', 'unavailable')



def test_api_health():
    from starlette.testclient import TestClient
    client = TestClient(api_module.app)
    r = client.get('/api/health')
    assert r.status_code == 200 and r.json()['symbol'] == 'XAU/USD'


def test_api_predict_latest():
    from starlette.testclient import TestClient
    client = TestClient(api_module.app)
    r = client.get('/api/predict/latest')
    assert r.status_code == 200 and 'status' in r.json()
