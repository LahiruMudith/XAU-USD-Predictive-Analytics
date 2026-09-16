"""Run both dashboard and API: python backend/run.py."""
import sys
from pathlib import Path

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app import app

if __name__ == '__main__':
    import uvicorn
    from backend.config import PORT
    uvicorn.run(app, host='127.0.0.1', port=PORT)
