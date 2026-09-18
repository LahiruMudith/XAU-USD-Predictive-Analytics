import json
import threading
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field, model_validator
from backend.config import ROOT, MODEL_DIR, TWELVE_KEY, ALLOWED_HOSTS
from backend.market import MarketService, ProviderError
from backend.forecast import ForecastService
from backend.news import NewsService
from ml.src.intraday_features import engineer
from ml.src.train_intraday import train

app = FastAPI(title='XAU/USD 15-Minute Analytics', version='2.0.0',
              description='Completed-candle direction forecasts, market data and news. Times are UTC.')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8765", "http://127.0.0.1:8765", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])
app.mount('/static', StaticFiles(directory=ROOT / 'frontend'), name='static')
market = MarketService()
forecaster = ForecastService()
news = NewsService()
training_pool = ThreadPoolExecutor(max_workers=1)
training_lock = threading.Lock()
training_job = {'status': 'idle', 'message': 'No training job running.'}


@app.middleware('http')
async def local_mutations(request: Request, call_next):
    if request.method == 'OPTIONS':
        response = await call_next(request)
        return response
    if request.method == 'POST':
        origin = request.headers.get('origin')
        if request.headers.get('sec-fetch-site') == 'cross-site' and origin and 'localhost' not in origin and '127.0.0.1' not in origin:
            return JSONResponse({'detail': 'Cross-origin requests are not allowed.'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.get('/')
def dashboard():
    return {'status': 'ok', 'app': 'XAU/USD Predictive Analytics API Server', 'docs': '/docs', 'frontend': 'http://localhost:3000'}


@app.get('/api/health')
def health():
    return {'status': 'ok', 'twelve_data_configured': bool(TWELVE_KEY),
            'intraday_model_available': forecaster.path.exists(), 'symbol': 'XAU/USD', 'interval': '15min'}


@app.get('/api/historical')
def historical(limit: int = Query(100, ge=1, le=5000)):
    frame, info = market.snapshot()
    return candle_response(frame, info, limit)


@app.get('/api/chart')
def live_chart(limit: int = Query(100, ge=1, le=5000)):
    """Chart-only data includes the forming candle; model inputs remain closed-only."""
    frame, info = market.snapshot(include_open=True)
    return candle_response(frame, info, limit)


def candle_response(frame, info, limit):
    tail = frame.tail(limit).copy()
    tail['datetime'] = tail.datetime.dt.strftime('%Y-%m-%dT%H:%M:%SZ')
    columns = ['datetime', 'open', 'high', 'low', 'close', 'rsi_14', 'macd', 'macd_signal',
               'sma_20', 'ema_50', 'bb_upper', 'bb_lower', 'atr_14']
    candles = json.loads(tail[columns].to_json(orient='records'))
    recent = frame[frame.datetime >= frame.datetime.max()-pd.Timedelta(hours=24)]
    return {'candles': candles, **info, 'last_candle_at': candles[-1]['datetime'] if candles else None,
            'high_24h': float(recent.high.max()) if len(recent) else None,
            'low_24h': float(recent.low.min()) if len(recent) else None}


@app.get('/api/predict/latest')
def latest():
    frame, info = market.snapshot()
    return forecaster.predict(frame, info)


@app.get('/api/indicators')
def indicators():
    frame, info = market.snapshot()
    if frame.empty:
        raise HTTPException(503, 'Market candles unavailable.')
    columns = ['datetime', 'rsi_14', 'macd', 'macd_signal', 'sma_20', 'ema_50', 'atr_14']
    return {'market': info, 'latest': json.loads(frame.tail(1)[columns].to_json(orient='records', date_format='iso'))[0]}


@app.post('/api/fetch-live')
def fetch_live():
    try:
        frame = market.refresh()
        return {'message': f'Loaded {len(frame)} XAU/USD 15-minute candles. Training is a separate action.', 'rows': len(frame)}
    except ProviderError as exc:
        raise HTTPException(503, str(exc)) from None


class Scenario(BaseModel):
    open: float = Field(gt=0, allow_inf_nan=False)
    high: float = Field(gt=0, allow_inf_nan=False)
    low: float = Field(gt=0, allow_inf_nan=False)
    close: float = Field(gt=0, allow_inf_nan=False)

    @model_validator(mode='after')
    def valid_candle(self):
        if self.low > min(self.open, self.close) or self.high < max(self.open, self.close):
            raise ValueError('Low and high must contain the open and close prices.')
        return self


@app.post('/api/predict')
def simulate(candle: Scenario):
    frame, info = market.snapshot()
    if info['interval'] != '15min' or frame.empty:
        raise HTTPException(503, 'Fetch 15-minute candles before simulating.')
    frame = frame.copy()
    for name, value in candle.model_dump().items():
        frame.loc[frame.index[-1], name] = value
    return forecaster.predict(engineer(frame), info, scenario=True)


@app.get('/api/metrics')
def metrics():
    try:
        bundle = forecaster.load()
    except (OSError, ValueError, KeyError):
        raise HTTPException(503, 'Model could not be loaded. Retrain it.') from None
    legacy = json.loads((ROOT / 'ml/saved_models/model_metadata.json').read_text())
    return {'intraday': bundle['metadata'] if bundle else None,
            'legacy_daily': {'metrics': legacy['metrics'], 'horizon': 'daily',
                'note': 'Daily artifacts and notebook SVC are preserved; neither is used for 15-minute inference.'}}


def train_job():
    global training_job
    try:
        frame = market.refresh()
        metadata = train(frame.copy(), MODEL_DIR)
        with training_lock:
            training_job = {'status': 'complete', 'message': '15-minute model trained and evaluated.',
                            'model': metadata['selected_model'], 'trained_at': metadata['trained_at']}
    except (ProviderError, ValueError) as exc:
        with training_lock:
            training_job = {'status': 'failed', 'message': str(exc)}
    except Exception:
        with training_lock:
            training_job = {'status': 'failed', 'message': 'Training failed. Check the dataset and Python dependencies.'}


@app.post('/api/models/train', status_code=202)
def start_training():
    global training_job
    with training_lock:
        if training_job['status'] == 'running':
            raise HTTPException(409, 'Training is already running.')
        training_job = {'status': 'running', 'message': 'Fetching candles and evaluating models. This may take a minute.'}
        training_pool.submit(train_job)
        return dict(training_job)


@app.get('/api/models/training')
def training_status():
    with training_lock:
        return dict(training_job)


@app.get('/api/news')
def market_news():
    return news.get()


@app.get('/api/market/details')
def market_details():
    return {'symbol': 'XAU/USD', 'name': 'Gold Spot / US Dollar', 'quote': 'USD per troy ounce',
            'interval': '15min', 'price_provider': 'Twelve Data', 'chart_symbol': 'OANDA:XAUUSD',
            'chart_note': 'TradingView displays OANDA prices. The model uses Twelve Data; quotes can differ by feed.',
            'news_providers': ['GDELT (no key)', 'Federal Reserve monetary policy RSS (no key)', 'FXStreet RSS (no key; non-commercial use)'],
            'inference': 'Latest completed candle -> shared features -> saved model -> next candle UP/DOWN.',
            'news_used_in_model': False}
