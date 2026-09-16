import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')
DATA_DIR = ROOT / 'ml/data/intraday'
MODEL_DIR = ROOT / 'ml/saved_models/intraday'
TWELVE_KEY = os.getenv('TWELVE_DATA_API_KEY', '')
PORT = int(os.getenv('APP_PORT', '8765'))
