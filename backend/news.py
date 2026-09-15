"""Public news feeds, cached independently from price data. No key required."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import threading
import time
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
import httpx


def safe_url(value):
    parsed = urlparse(value)
    return value if parsed.scheme in ('http', 'https') and parsed.netloc else None


def gdelt():
    with httpx.Client(timeout=20, follow_redirects=True) as client:
        r = client.get('https://api.gdeltproject.org/api/v2/doc/doc', params={
            'query': '("gold price" OR "gold prices" OR XAUUSD OR "gold bullion") sourcelang:english',
            'mode': 'artlist', 'format': 'json', 'maxrecords': 15, 'sort': 'datedesc', 'timespan': '3d'})
        r.raise_for_status()
        payload = r.json()
    items = []
    for article in payload.get('articles', []):
        url = safe_url(article.get('url', ''))
        if not url:
            continue
        stamp = datetime.strptime(article['seendate'], '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc).isoformat()
        items.append({'title': article['title'], 'url': url, 'source': article.get('domain', 'GDELT'),
                      'time': stamp, 'time_label': 'First seen by GDELT', 'category': 'Gold news'})
    return items


def federal_reserve():
    with httpx.Client(timeout=15, follow_redirects=True) as client:
        r = client.get('https://www.federalreserve.gov/feeds/press_monetary.xml')
        r.raise_for_status()
    if len(r.content) > 2_000_000:
        raise ValueError('Feed too large')
    root = ET.fromstring(r.content)
    items = []
    for item in root.findall('.//item')[:8]:
        url = safe_url(item.findtext('link', ''))
        if url:
            stamp = parsedate_to_datetime(item.findtext('pubDate')).astimezone(timezone.utc).isoformat()
            items.append({'title': item.findtext('title', 'Federal Reserve update'), 'url': url,
                'source': 'Federal Reserve', 'time': stamp, 'time_label': 'Published', 'category': 'Monetary policy'})
    return items


def fxstreet():
    with httpx.Client(timeout=15, follow_redirects=True) as client:
        r = client.get('https://www.fxstreet.com/rss/news')
        r.raise_for_status()
    if len(r.content) > 2_000_000:
        raise ValueError('Feed too large')
    root = ET.fromstring(r.content)
    items = []
    for item in root.findall('.//item'):
        title = item.findtext('title', '')
        if not any(word in title.lower() for word in ('gold', 'xau', 'federal reserve', 'fed ', 'inflation', 'treasury', 'us dollar')):
            continue
        url = safe_url(item.findtext('link', ''))
        if url:
            stamp = parsedate_to_datetime(item.findtext('pubDate')).astimezone(timezone.utc).isoformat()
            items.append({'title': title, 'url': url, 'source': 'FXStreet', 'time': stamp,
                          'time_label': 'Published', 'category': 'Gold & macro news'})
    return items[:12]


class NewsService:
    def __init__(self):
        self.checked = 0.0
        self.cache = {'items': [], 'providers': [], 'fetched_at': None}
        self.lock = threading.Lock()

    def get(self):
        with self.lock:
            if time.monotonic()-self.checked < 600:
                return self.cache
            self.checked = time.monotonic()
            items, statuses = [], []
            with ThreadPoolExecutor(max_workers=3) as pool:
                jobs = [(name, pool.submit(fetch)) for name, fetch in [('GDELT', gdelt), ('Federal Reserve', federal_reserve), ('FXStreet', fxstreet)]]
                for name, job in jobs:
                    try:
                        rows = job.result()
                        items.extend(rows)
                        statuses.append({'name': name, 'status': 'ok', 'count': len(rows)})
                    except (httpx.HTTPError, ValueError, KeyError, TypeError, ET.ParseError):
                        statuses.append({'name': name, 'status': 'unavailable', 'count': 0})
            seen = set()
            unique = []
            for item in sorted(items, key=lambda x: x['time'], reverse=True):
                if item['url'] not in seen:
                    unique.append(item)
                    seen.add(item['url'])
            self.cache = {'items': unique, 'providers': statuses, 'fetched_at': datetime.now(timezone.utc).isoformat(),
                'usage': 'News is market context only. It is not an input to this price-based direction model.'}
            return self.cache
