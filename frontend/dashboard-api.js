// API and page state. Chart rendering lives in app.js.
let latestForecast = null;
let refreshRunning = false;
let trainingTimer = null;
let chartLoading = false;
let lastChartResponse = 0;

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, signal: AbortSignal.timeout(35000) });
  const data = await response.json();
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Invalid request. Check the candle values.';
    throw new Error(detail);
  }
  return data;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function utc(value) {
  return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC' : '--';
}

function showUnavailable(message) {
  latestForecast = null;
  setText('signal-badge', 'UNAVAILABLE');
  document.getElementById('signal-badge').className = 'signal-badge neutral';
  setText('forecast-status', message);
  setText('pred-price', '--');
  setText('pred-change', '--');
  setText('forecast-window', '--');
  setText('risk-levels', '--');
  for (const id of ['metric-rsi', 'metric-macd', 'metric-sma', 'metric-ema']) setText(id, '--');
}

async function fetchLatestPrediction() {
  try {
    const data = await api('/api/predict/latest');
    if (data.status !== 'ok') {
      showUnavailable(data.reason || 'Forecast unavailable');
      return;
    }
    latestForecast = data;
    setText('signal-badge', data.direction === 'UP' ? 'UP ▲' : 'DOWN ▼');
    document.getElementById('signal-badge').className = `signal-badge ${data.signal.toLowerCase()}`;
    setText('pred-price', `$${data.current_close.toFixed(2)}`);
    setText('pred-change', data.up_score === null ? 'Probability unavailable for this model' :
      `Model scores: UP ${(data.up_score * 100).toFixed(1)}% · DOWN ${(data.down_score * 100).toFixed(1)}%`);
    setText('forecast-window', `${utc(data.as_of)} → ${utc(data.forecast_end)}`);
    setText('forecast-status', `${data.validation_warning} ${data.score_label}` +
      (data.model_age_days > 7 ? ' Model is over 7 days old; refresh data and retrain.' : '') +
      (data.market.error ? ` Latest refresh failed: ${data.market.error}` : ''));
    setText('ticker-active-model', data.model + ' · 15 min');
    setText('metric-rsi', data.indicators.rsi_14.toFixed(1));
    setText('metric-macd', data.indicators.macd.toFixed(2));
    setText('metric-sma', `$${data.indicators.sma_20.toFixed(1)}`);
    setText('metric-ema', `$${data.indicators.ema_50.toFixed(1)}`);
    setText('risk-levels', `ATR example: stop $${data.risk_example.stop_loss.toFixed(2)} · target $${data.risk_example.take_profit.toFixed(2)}. Excludes spread and slippage.`);
  } catch (error) {
    showUnavailable(error.message);
  }
}

async function loadDashboardData() {
  if (chartLoading) return;
  chartLoading = true;
  try {
    const limit = document.getElementById('candle-count-select').value;
    const data = await api(`/api/chart?limit=${limit}`);
    lastChartResponse = Date.now();
    cachedCandles = data.candles || [];
    setText('status-text', data.live ? 'Live chart · 15s refresh' : 'Chart delayed / market closed');
    setText('data-source', `${data.source} · ${data.interval}`);
    setText('data-timestamp', `Provider fetched: ${utc(data.fetched_at)}. Candle opened: ${utc(data.last_candle_at)}. ${data.error || (data.forming ? 'Latest candle is forming; its price and indicators can change. Predictions use completed candles.' : 'No current forming candle available.')}`);
    setText('chart-symbol-badge', `XAU/USD · ${data.interval}`);
    setText('legend-interval', `XAU/USD ${data.interval}`);
    if (cachedCandles.length) {
      const latest = cachedCandles[cachedCandles.length - 1];
      setText('ticker-current-price', `$${latest.close.toFixed(2)}`);
      setText('ticker-high-low', `$${data.high_24h.toFixed(2)} / $${data.low_24h.toFixed(2)}`);
      if (!document.getElementById('sim-open').value) populateSimulatorDefaults(latest);
      renderPriceChart(cachedCandles);
      if (typeof Chart !== 'undefined') renderIndicatorChart(cachedCandles);
      else setText('indicator-val', 'Indicator chart library unavailable; numeric indicators remain available.');
    }
  } catch (error) {
    setText('status-text', 'Data unavailable');
    setText('data-timestamp', error.message);
  } finally {
    chartLoading = false;
  }
}

async function refreshDashboard() {
  if (refreshRunning) return;
  refreshRunning = true;
  try { await Promise.all([loadDashboardData(), fetchLatestPrediction()]); }
  finally { refreshRunning = false; }
}

async function handleScenarioSimulation(event) {
  event.preventDefault();
  const payload = Object.fromEntries(['open', 'high', 'low', 'close'].map(name => [name, Number(document.getElementById(`sim-${name}`).value)]));
  document.getElementById('sim-result').classList.remove('hidden');
  try {
    const data = await api('/api/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (data.status !== 'ok') throw new Error(data.reason);
    setText('sim-res-price', data.up_score === null ? 'Score unavailable' : `UP ${(data.up_score * 100).toFixed(1)}% (uncalibrated)`);
    setText('sim-res-dir', `${data.direction} · hypothetical candle`);
  } catch (error) {
    setText('sim-res-price', error.message);
    setText('sim-res-dir', '--');
  }
}

async function loadBenchmarkMetrics() {
  const container = document.getElementById('benchmark-cards');
  try {
    const data = await api('/api/metrics');
    container.replaceChildren();
    if (!data.intraday) { container.textContent = 'Train the 15-minute model to see evaluation metrics.'; return; }
    const metadata = data.intraday;
    setText('benchmark-note', `${metadata.rows} usable rows · ${metadata.test_rows} holdout rows · trained ${utc(metadata.trained_at)}. Selected by chronological CV.`);
    for (const [name, result] of Object.entries(metadata.model_results)) {
      const card = document.createElement('div');
      card.className = `model-benchmark-card ${name === metadata.selected_model ? 'highlight' : ''}`;
      const title = document.createElement('h4');
      title.textContent = name + (name === metadata.selected_model ? ' · Selected' : '');
      card.appendChild(title);
      for (const [label, value] of [
        ['CV balanced accuracy', result.cv_balanced_accuracy], ['Holdout accuracy', result.test.accuracy],
        ['Holdout balanced accuracy', result.test.balanced_accuracy], ['Precision', result.test.precision],
        ['Recall', result.test.recall], ['F1', result.test.f1]]) {
        const row = document.createElement('p');
        row.className = 'benchmark-row';
        row.textContent = `${label}: ${(value * 100).toFixed(1)}%`;
        card.appendChild(row);
      }
      container.appendChild(card);
    }
  } catch (error) { container.textContent = error.message; }
}

async function handleTwelveDataFetch() {
  const status = document.getElementById('modal-status-msg');
  status.className = 'modal-status';
  status.textContent = 'Fetching 15-minute gold candles...';
  try {
    const data = await api('/api/fetch-live', { method: 'POST' });
    status.className = 'modal-status success';
    status.textContent = data.message;
    await refreshDashboard();
  } catch (error) { status.className = 'modal-status error'; status.textContent = error.message; }
}

async function trainModel() {
  const button = document.getElementById('btn-train-model');
  button.disabled = true;
  try {
    const job = await api('/api/models/train', { method: 'POST' });
    setText('training-status', job.message);
    trainingTimer = setInterval(async () => {
      try {
        const status = await api('/api/models/training');
        setText('training-status', status.message);
        if (status.status !== 'running') {
          clearInterval(trainingTimer);
          button.disabled = false;
          await Promise.all([loadBenchmarkMetrics(), fetchLatestPrediction()]);
        }
      } catch (error) { clearInterval(trainingTimer); button.disabled = false; setText('training-status', error.message); }
    }, 3000);
  } catch (error) { button.disabled = false; setText('training-status', error.message); }
}

async function loadNews() {
  const container = document.getElementById('news-items');
  try {
    const data = await api('/api/news');
    container.replaceChildren();
    setText('news-status', data.providers.map(p => `${p.name}: ${p.status}`).join(' · ') + ` · Checked ${utc(data.fetched_at)}`);
    for (const item of data.items) {
      const article = document.createElement('article');
      article.className = 'news-item';
      const link = document.createElement('a');
      const url = new URL(item.url);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = item.title;
      const meta = document.createElement('p');
      meta.textContent = `${item.source} · ${item.category} · ${item.time_label}: ${utc(item.time)}`;
      article.append(link, meta); container.appendChild(article);
    }
    if (!data.items.length) container.textContent = 'News sources are temporarily unavailable. Price forecasts continue independently.';
  } catch (error) { container.textContent = `News unavailable: ${error.message}`; }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-train-model').addEventListener('click', trainModel);
  loadNews();
  setInterval(() => { if (!document.hidden) refreshDashboard(); }, 60000);
  setInterval(() => { if (!document.hidden) loadDashboardData(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDashboard(); });
  setInterval(() => { if (!document.hidden) loadNews(); }, 600000);
  setInterval(() => {
    if (lastChartResponse && Date.now() - lastChartResponse > 45000) {
      setText('status-text', 'Chart delayed / reconnecting');
    }
    if (latestForecast && Date.now() >= Date.parse(latestForecast.forecast_end)) {
      showUnavailable('Forecast window ended. Waiting for the next completed candle.');
      refreshDashboard();
    }
  }, 1000);
});
