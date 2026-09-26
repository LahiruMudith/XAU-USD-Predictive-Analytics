from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from backend.config import TWELVE_KEY
from backend.services.market_service import MarketService
from backend.services.forecast_service import ForecastService

app = FastAPI(title='XAU/USD 15-Minute Analytics', version='2.0.0',
              description='Completed-candle direction forecasts and market analytics.')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8765", "http://127.0.0.1:8765", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

market = MarketService()
forecaster = ForecastService()


@app.get('/')
def dashboard():
    return {'status': 'ok', 'app': 'XAU/USD Predictive Analytics API Server', 'docs': '/docs', 'frontend': 'http://localhost:3000'}


@app.get('/api/health')
def health():
    return {'status': 'ok', 'twelve_data_configured': bool(TWELVE_KEY),
            'intraday_model_available': forecaster.path.exists(), 'symbol': 'XAU/USD', 'interval': '15min'}


@app.get('/api/predict/latest')
def latest():
    frame, info = market.snapshot()
    return forecaster.predict(frame, info)
