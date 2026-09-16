"""Offline regression tests for data integrity, API behavior, and forecast timing."""
import importlib
import json
import time
import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.dummy import DummyClassifier
from backend.forecast import ForecastService
from backend.market import MarketService, ProviderError
from backend.news import NewsService, safe_url
from ml.src.intraday_features import FEATURES, clean_candles, closed_candles, engineer, training_rows
from ml.src.train_intraday import train

api_module = importlib.import_module('backend.app')


@pytest.fixture
def candles():
    rng = np.random.default_rng(42)
    close = 3000 + np.cumsum(rng.normal(0, 3, 1100))
    return pd.DataFrame({'datetime': pd.date_range('2025-01-01', periods=1100, freq='15min', tz='UTC'),
        'open': close-1, 'high': close+2, 'low': close-2, 'close': close})


@pytest.fixture
def service(tmp_path, candles):
    x = engineer(candles).dropna(subset=FEATURES)
    model = DummyClassifier(strategy='prior').fit(x[FEATURES], np.arange(len(x)) % 2)
    metadata = {'interval': '15min', 'symbol': 'XAU/USD', 'feature_columns': FEATURES,
        'selected_model': 'test', 'trained_at': '2025-01-01T00:00:00+00:00', 'data_end': '2025-01-01T00:00:00+00:00',
        'validation_warning': 'test model', 'model_results': {'test': {'test': {'accuracy': .5}}}}
    joblib.dump({'model': model, 'metadata': metadata}, tmp_path / 'model.joblib')
    return ForecastService(tmp_path)


@pytest.fixture
def client(monkeypatch, candles, service):
    frame = engineer(candles)
    monkeypatch.setattr(api_module.market, 'snapshot', lambda **kwargs: (frame, {'interval': '15min', 'live': False, 'source': 'Test', 'error': None}))
    monkeypatch.setattr(api_module, 'forecaster', service)
    return TestClient(api_module.app)


def test_features_do_not_use_future_candles(candles):
    full = engineer(candles)
    prefix = engineer(candles.iloc[:500])
    pd.testing.assert_frame_equal(full.iloc[:500][FEATURES], prefix[FEATURES])


def test_targets_exclude_gaps_and_last_row(candles):
    gapped = candles.drop(index=600).reset_index(drop=True)
    rows = training_rows(gapped)
    assert (rows.target_time - rows.datetime == pd.Timedelta(minutes=30)).all()
    assert candles.datetime.iloc[-1] not in rows.datetime.values
    for _, row in rows.iloc[:10].iterrows():
        nxt = candles.loc[candles.datetime == row.datetime+pd.Timedelta(minutes=15)].iloc[0]
        assert row.target == int(nxt.close > row.close)


def test_partial_bar_and_invalid_ohlc(candles):
    now = candles.datetime.iloc[-1]+pd.Timedelta(minutes=5)
    closed = closed_candles(candles, now)
    assert len(closed) == len(candles)-1
    invalid = candles.copy()
    invalid.loc[0, 'high'] = 1
    assert len(clean_candles(invalid)) == len(candles)-1


def test_latest_provider_revision_replaces_cached_candle(candles):
    revisions = candles.iloc[-100:].copy()
    revisions['close'] += 1
    merged = clean_candles(pd.concat([candles, revisions], ignore_index=True))
    assert len(merged) == len(candles)
    np.testing.assert_allclose(merged.close.tail(100), revisions.close)


def test_forecast_expiration_and_no_daily_fallback(service, candles):
    f = engineer(candles)
    end = f.datetime.iloc[-1]+pd.Timedelta(minutes=30)
    info = {'interval': '15min', 'source': 'Test'}
    result = service.predict(f, info, now=end-pd.Timedelta(seconds=1))
    assert result['status'] == 'ok'
    assert result['direction'] in ('UP', 'DOWN')
    assert np.isclose(result['up_score'] + result['down_score'], 1)
    expired = service.predict(f, info, now=end)
    assert expired['status'] == 'stale' and expired['direction'] is None
    daily = service.predict(f, {'interval': '1day'}, now=end)
    assert daily['status'] == 'unavailable' and daily['direction'] is None


def test_assets_history_and_scenario(client):
    assert client.get('/').status_code == 200
    for asset in ['app.js', 'dashboard-api.js', 'style.css', 'lightweight-charts.standalone.production.js']:
        assert client.get('/static/'+asset).status_code == 200
    candles = client.get('/api/historical?limit=50').json()['candles']
    assert len(candles) == 50
    assert candles[-1]['datetime'].endswith('Z')
    assert len(client.get('/api/chart?limit=50').json()['candles']) == 50
    response = client.post('/api/predict', json={'open': 3000, 'high': 3010, 'low': 2990, 'close': 3005})
    assert response.status_code == 200
    assert response.json()['scenario'] is True
    assert client.post('/api/predict', json={'open': 3000, 'high': 2900, 'low': 2800, 'close': 3005}).status_code == 422
    assert client.get('/api/historical?limit=-1').status_code == 422
    assert client.post('/api/models/train', headers={'Origin': 'https://evil.example'}).status_code == 403
    assert client.get('/.env').status_code == 404


def test_live_chart_includes_forming_candle_but_model_does_not(tmp_path, candles):
    market = MarketService(key='', data_dir=tmp_path)
    now = pd.Timestamp.now(tz='UTC')
    current_open = now.floor('15min')
    candles = candles.copy()
    candles['datetime'] = pd.date_range(end=current_open, periods=len(candles), freq='15min')
    market.frame = candles
    market.fetched_at = now.isoformat()
    chart, info = market.snapshot(refresh=False, include_open=True)
    model, _ = market.snapshot(refresh=False)
    assert info['forming'] and info['live']
    assert chart.datetime.iloc[-1] == current_open
    assert model.datetime.iloc[-1] == current_open-pd.Timedelta(minutes=15)
    original_features = model.iloc[-1][FEATURES].copy()
    market.frame.loc[market.frame.index[-1], 'close'] += 1
    updated_chart, _ = market.snapshot(refresh=False, include_open=True)
    updated_model, _ = market.snapshot(refresh=False)
    assert updated_chart.close.iloc[-1] == chart.close.iloc[-1]+1
    pd.testing.assert_series_equal(original_features, updated_model.iloc[-1][FEATURES])
    market.error = 'Provider unavailable'
    assert not market.snapshot(refresh=False, include_open=True)[1]['live']


def test_missing_key_falls_back_explicitly(tmp_path):
    market = MarketService(key='', data_dir=tmp_path)
    with pytest.raises(ProviderError, match='TWELVE_DATA_API_KEY'):
        market.refresh()
    frame, info = market.snapshot()
    assert info['interval'] == '1day' and not info['live']
    assert not frame.empty


def test_provider_errors_redact_keys_and_keep_cache(monkeypatch, tmp_path, candles):
    import httpx
    class FakeClient:
        def __init__(self, **kw): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def get(self, *args, **kw):
            return httpx.Response(200, json={'status': 'error', 'message': 'bad secret-test-key'})
    monkeypatch.setattr('backend.market.httpx.Client', FakeClient)
    market = MarketService(key='secret-test-key', data_dir=tmp_path)
    market.frame = candles
    with pytest.raises(ProviderError) as error:
        market.refresh()
    assert 'secret-test-key' not in str(error.value)
    assert len(market.frame) == len(candles)


def test_training_chronological_contract(tmp_path, candles):
    metadata = train(candles, tmp_path)
    assert metadata['cv_folds'] == 5 and metadata['gap'] == 1
    assert metadata['rows'] > 800
    assert metadata['selected_model'] in ['Random Forest', 'SVC']
    assert pd.Timestamp(metadata['data_start']) < pd.Timestamp(metadata['holdout_start']) < pd.Timestamp(metadata['data_end'])
    assert len(metadata['model_results']) == 3
    bundle = joblib.load(tmp_path / 'model.joblib')
    assert bundle['metadata'] == metadata


def test_news_partial_failure_and_safe_links(monkeypatch):
    def unavailable(): raise ValueError('Provider down')
    monkeypatch.setattr('backend.news.gdelt', unavailable)
    monkeypatch.setattr('backend.news.fxstreet', unavailable)
    monkeypatch.setattr('backend.news.federal_reserve', lambda: [{'url': 'https://example.org/news', 'time': '2025-01-01', 'title': 'Policy'}])
    result = NewsService().get()
    assert len(result['items']) == 1
    assert result['providers'][0]['status'] == 'unavailable'
    assert safe_url('javascript:alert(1)') is None
