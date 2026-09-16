"""Twelve Data adapter. Keys never leave the server except to Twelve Data."""
import threading
import time
import httpx
import pandas as pd
from backend.config import DATA_DIR, ROOT, TWELVE_KEY
from ml.src.intraday_features import clean_candles, closed_candles, engineer


class ProviderError(Exception):
    pass


class MarketService:
    def __init__(self, key=TWELVE_KEY, data_dir=DATA_DIR):
        self.key = key
        self.path = data_dir / 'XAU_USD_15min.csv'
        self.lock = threading.RLock()
        self.checked = 0.0
        self.error = None
        self.frame = None
        self.fetched_at = None
        if self.path.exists():
            self.frame = clean_candles(pd.read_csv(self.path))
            self.fetched_at = pd.Timestamp(self.path.stat().st_mtime, unit='s', tz='UTC').isoformat()

    def refresh(self, outputsize=5000):
        with self.lock:
            if time.monotonic() - self.checked < 15:
                if self.error:
                    raise ProviderError(self.error)
                return self.frame
            self.checked = time.monotonic()
            try:
                if not self.key:
                    raise ProviderError('Set TWELVE_DATA_API_KEY in the backend .env file.')
                with httpx.Client(timeout=25) as client:
                    r = client.get('https://api.twelvedata.com/time_series', params={
                        'symbol': 'XAU/USD', 'interval': '15min', 'outputsize': outputsize,
                        'timezone': 'UTC', 'apikey': self.key})
                if r.status_code in (401, 403):
                    raise ProviderError('Twelve Data rejected access. Check the API key and XAU/USD intraday entitlement.')
                if r.status_code == 429:
                    raise ProviderError('Twelve Data rate limit reached. Retry after the provider quota resets.')
                if r.status_code != 200:
                    raise ProviderError(f'Twelve Data is unavailable (HTTP {r.status_code}).')
                payload = r.json()
                if payload.get('status') == 'error':
                    message = str(payload.get('message', 'Request rejected')).replace(self.key, '[redacted]')
                    raise ProviderError('Twelve Data: ' + message[:400])
                meta = payload.get('meta', {})
                if meta.get('symbol') != 'XAU/USD' or meta.get('interval') != '15min':
                    raise ProviderError('Provider returned a different instrument or candle interval.')
                fresh = clean_candles(pd.DataFrame(payload.get('values', [])))
                if fresh.empty:
                    raise ProviderError('Provider returned no valid gold candles.')
                if self.frame is not None:
                    fresh = clean_candles(pd.concat([self.frame, fresh], ignore_index=True))
                self.frame = fresh.tail(50000).reset_index(drop=True)
                self.path.parent.mkdir(parents=True, exist_ok=True)
                temp = self.path.with_suffix('.tmp')
                self.frame.to_csv(temp, index=False)
                temp.replace(self.path)
                self.fetched_at = pd.Timestamp.now(tz='UTC').isoformat()
                self.error = None
                return self.frame
            except ProviderError as exc:
                self.error = str(exc)
                raise
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                self.error = 'Unable to read Twelve Data. Check network access and provider availability.'
                raise ProviderError(self.error) from None

    def snapshot(self, refresh=True, include_open=False):
        if refresh:
            try:
                self.refresh(outputsize=100 if self.frame is not None and len(self.frame) >= 5000 else 5000)
            except ProviderError:
                pass
        with self.lock:
            if self.frame is None:
                raw = pd.read_csv(ROOT / 'ml/data/processed/XAU_USD_Final_Engineered.csv')
                raw = raw.rename(columns={'Date': 'datetime', 'Open': 'open', 'High': 'high', 'Low': 'low', 'Close': 'close'})
                raw['datetime'] = pd.to_datetime(raw.datetime, format='%m/%d/%Y', utc=True)
                return engineer(clean_candles(raw)), {'source': 'Bundled daily archive', 'interval': '1day',
                    'live': False, 'error': self.error, 'fetched_at': None}
            now = pd.Timestamp.now(tz='UTC')
            if include_open:
                frame = self.frame.loc[self.frame.datetime <= now].copy()
                forming = not frame.empty and frame.iloc[-1].datetime + pd.Timedelta(minutes=15) > now
                fresh = self.fetched_at is not None and (now-pd.Timestamp(self.fetched_at)).total_seconds() < 45
                return engineer(frame), {'source': 'Twelve Data', 'interval': '15min',
                    'live': bool(forming and fresh and not self.error), 'forming': bool(forming),
                    'error': self.error, 'fetched_at': self.fetched_at, 'refresh_seconds': 15}
            closed = closed_candles(self.frame.copy())
            live = not closed.empty and closed.iloc[-1].datetime + pd.Timedelta(minutes=30) > now
            return engineer(closed), {'source': 'Twelve Data', 'interval': '15min', 'live': bool(live),
                'error': self.error, 'fetched_at': self.fetched_at}
