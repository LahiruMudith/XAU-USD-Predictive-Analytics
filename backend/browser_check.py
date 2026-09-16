"""Manual integration check: python backend/browser_check.py (requires Playwright + Edge)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
artifacts = root / 'artifacts'
artifacts.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8765', wait_until='domcontentloaded')
    page.wait_for_function("document.getElementById('signal-badge').textContent !== 'WAITING'", timeout=40000)
    page.wait_for_function("document.querySelectorAll('.model-benchmark-card').length === 3", timeout=40000)
    page.wait_for_function("document.getElementById('news-status').textContent !== 'Loading public feeds...'", timeout=40000)
    print('Forecast:', page.locator('#signal-badge').inner_text())
    print('Forecast window:', page.locator('#forecast-window').inner_text())
    print('Feed:', page.locator('#data-source').inner_text())
    print('News:', page.locator('#news-status').inner_text())
    assert page.locator('#mlCandleChart canvas').count() > 0
    # Replay a provider update to verify automatic polling and viewport preservation.
    chart_data = page.request.get('http://127.0.0.1:8765/api/chart?limit=100').json()
    print('Chart forming candle:', chart_data.get('forming'), 'refresh seconds:', chart_data.get('refresh_seconds'))
    chart_data['candles'][-1]['close'] += .25
    chart_data['candles'][-1]['high'] = max(chart_data['candles'][-1]['high'], chart_data['candles'][-1]['close'])
    expected_close = chart_data['candles'][-1]['close']
    page.evaluate('lwChart.timeScale().setVisibleLogicalRange({from: 20, to: 60})')
    previous_range = page.evaluate('lwChart.timeScale().getVisibleRange()')
    page.route('**/api/chart?*', lambda route: route.fulfill(json=chart_data))
    page.wait_for_function('(value) => Math.abs(lwCandleSeries.data().at(-1).close - value) < 0.000001', arg=expected_close, timeout=22000)
    assert page.evaluate('lwChart.timeScale().getVisibleRange()') == previous_range
    print('Automatic forming-candle update and viewport preservation: passed')
    page.unroute('**/api/chart?*')
    page.evaluate('loadDashboardData()')
    page.locator('#tab-btn-tv').click()
    page.wait_for_selector('#tradingview_widget_container iframe', timeout=30000)
    print('TradingView iframe loaded:', page.locator('#tradingview_widget_container iframe').count())
    page.locator('#tab-btn-ml').click()
    page.locator('#simulator-form button[type=submit]').click()
    page.wait_for_function("document.getElementById('sim-res-dir').textContent.includes('hypothetical')", timeout=35000)
    print('Scenario:', page.locator('#sim-res-dir').inner_text())
    page.screenshot(path=str(artifacts / 'dashboard-desktop.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(artifacts / 'dashboard-mobile.png'), full_page=True)
    overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
    print('Mobile overflow:', overflow)
    assert not overflow
    page.route('**/api/predict/latest', lambda route: route.fulfill(json={'status': 'stale', 'reason': 'Test: stale candle', 'direction': None}))
    page.locator('#btn-predict-now').click()
    page.wait_for_function("document.getElementById('signal-badge').textContent === 'UNAVAILABLE'")
    assert page.locator('#pred-price').inner_text() == '--'
    print('Stale-data UI: passed')
    print('Browser errors:', errors)
    assert not errors
    browser.close()
