/**
 * Frontend client logic for XAU/USD Gold Price Prediction ML Dashboard
 */

// TradingView Configuration & State
const DEFAULT_TV_URL = "https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD&interval=15";
const DEFAULT_TV_SYMBOL = "OANDA:XAUUSD";

let currentTvUrl = DEFAULT_TV_URL;
let currentTvSymbol = DEFAULT_TV_SYMBOL;
let tvWidget = null;
let currentChartView = "ml"; // 'ml' (Candlestick Terminal) or 'tv' (TradingView Web)
let currentChartStyle = "candlestick"; // 'candlestick' or 'line'

// Lightweight Charts State (Candlestick Engine)
let lwChart = null;
let lwCandleSeries = null;
let lwLineSeries = null;
let lwSmaSeries = null;
let lwEmaSeries = null;
let lwBbUpperSeries = null;
let lwBbLowerSeries = null;

let priceChart = null;
let indicatorChart = null;
let currentActiveIndicator = "rsi"; // 'rsi' or 'macd'
let cachedCandles = [];
let displayedChartCount = null;

const API_BASE = window.location.origin;

document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  refreshDashboard();
  loadBenchmarkMetrics();
});

function initEventListeners() {
  // Candlestick vs Line style toggle
  const btnCandle = document.getElementById("btn-chart-candlestick");
  const btnLine = document.getElementById("btn-chart-line");
  if (btnCandle) btnCandle.addEventListener("click", () => setChartStyle("candlestick"));
  if (btnLine) btnLine.addEventListener("click", () => setChartStyle("line"));

  // Chart tab switching (Candlestick Terminal vs TradingView Web)
  document.querySelectorAll(".chart-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const targetView = e.currentTarget.getAttribute("data-chart");
      switchChartView(targetView);
    });
  });

  // Responsive chart resize handler
  window.addEventListener("resize", () => {
    if (lwChart) {
      const container = document.getElementById("mlCandleChart");
      if (container && container.clientWidth > 0) {
        lwChart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight || 440
        });
      }
    }
  });

  // TradingView modal triggers
  const tvModal = document.getElementById("tv-modal");
  const btnOpenTvModal = document.getElementById("btn-open-tv-modal");
  const btnCloseTvModal = document.getElementById("btn-close-tv-modal");
  const btnCancelTvModal = document.getElementById("btn-cancel-tv-modal");
  const btnSaveTvUrl = document.getElementById("btn-save-tv-url");
  const modalTvUrlInput = document.getElementById("modal-tv-url");
  const modalTvSymbolInput = document.getElementById("modal-tv-symbol");

  if (btnOpenTvModal) {
    btnOpenTvModal.addEventListener("click", () => {
      modalTvUrlInput.value = currentTvUrl;
      modalTvSymbolInput.value = currentTvSymbol;
      const statusEl = document.getElementById("tv-modal-status-msg");
      if (statusEl) statusEl.classList.add("hidden");
      tvModal.classList.remove("hidden");
    });
  }

  if (btnCloseTvModal) btnCloseTvModal.addEventListener("click", () => tvModal.classList.add("hidden"));
  if (btnCancelTvModal) btnCancelTvModal.addEventListener("click", () => tvModal.classList.add("hidden"));

  if (modalTvUrlInput) {
    modalTvUrlInput.addEventListener("input", (e) => {
      const extracted = extractSymbolFromUrl(e.target.value.trim());
      if (extracted && modalTvSymbolInput) modalTvSymbolInput.value = extracted;
    });
  }

  if (btnSaveTvUrl) {
    btnSaveTvUrl.addEventListener("click", () => {
      const newUrl = modalTvUrlInput.value.trim() || DEFAULT_TV_URL;
      const newSymbol = modalTvSymbolInput.value.trim() || extractSymbolFromUrl(newUrl);

      currentTvUrl = newUrl;
      currentTvSymbol = newSymbol;
      localStorage.setItem("tv_chart_url", currentTvUrl);
      localStorage.setItem("tv_chart_symbol", currentTvSymbol);

      initTradingViewWidget(currentTvSymbol);

      const statusMsg = document.getElementById("tv-modal-status-msg");
      if (statusMsg) {
        statusMsg.textContent = `Connected to ${currentTvSymbol}!`;
        statusMsg.className = "modal-status success";
        statusMsg.classList.remove("hidden");
      }

      setTimeout(() => {
        tvModal.classList.add("hidden");
      }, 1000);
    });
  }

  // Model selector change
  document.getElementById("model-select").addEventListener("change", (e) => {
    document.getElementById("ticker-active-model").innerText = e.target.options[e.target.selectedIndex].text;
    fetchLatestPrediction();
  });

  // Run prediction button
  document.getElementById("btn-predict-now").addEventListener("click", fetchLatestPrediction);

  // Refresh data button
  document.getElementById("btn-refresh-data").addEventListener("click", () => {
    refreshDashboard();
  });

  // Candle count selector
  document.getElementById("candle-count-select").addEventListener("change", () => {
    loadDashboardData();
  });

  // Indicator toggles on main chart
  ["toggle-sma", "toggle-ema", "toggle-bb"].forEach(id => {
    document.getElementById(id).addEventListener("change", updateChartDatasets);
  });

  // Indicator sub-tabs (RSI vs MACD)
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentActiveIndicator = e.target.getAttribute("data-target");
      if (typeof Chart !== "undefined" && cachedCandles.length) renderIndicatorChart(cachedCandles);
    });
  });

  // Simulator Form
  document.getElementById("simulator-form").addEventListener("submit", handleScenarioSimulation);

  // Twelve Data Modal
  const modal = document.getElementById("api-modal");
  document.getElementById("btn-open-api-modal").addEventListener("click", () => modal.classList.remove("hidden"));
  document.getElementById("btn-close-modal").addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("btn-cancel-modal").addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("btn-save-fetch-api").addEventListener("click", handleTwelveDataFetch);
}

/** Extract symbol query parameter or fallback */
function extractSymbolFromUrl(url) {
  try {
    const parsed = new URL(url);
    const sym = parsed.searchParams.get("symbol");
    if (sym) return decodeURIComponent(sym);
  } catch (e) {
    const match = url.match(/[?&]symbol=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return DEFAULT_TV_SYMBOL;
}

/** Official TradingView embed, locked to the market and interval used on this page. */
function initTradingViewWidget() {
  const container = document.getElementById("tradingview_widget_container");
  container.replaceChildren();
  const wrapper = document.createElement("div");
  wrapper.className = "tradingview-widget-container";
  wrapper.style.cssText = "height:100%;width:100%";
  const chart = document.createElement("div");
  chart.className = "tradingview-widget-container__widget";
  chart.style.cssText = "height:calc(100% - 32px);width:100%";
  const credit = document.createElement("a");
  credit.href = DEFAULT_TV_URL; credit.target = "_blank"; credit.rel = "noopener noreferrer";
  credit.textContent = "XAUUSD chart by TradingView · OANDA · 15 minutes";
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.textContent = JSON.stringify({ autosize: true, symbol: "OANDA:XAUUSD", interval: "15",
    timezone: "Etc/UTC", theme: "dark", style: "1", locale: "en", allow_symbol_change: false,
    hide_side_toolbar: false, hide_volume: true, calendar: true, details: true, withdateranges: true });
  script.onerror = () => { credit.textContent = "TradingView unavailable here. Open the XAUUSD chart directly."; };
  wrapper.append(chart, credit, script); container.append(wrapper);
  tvWidget = true;
}

/** Switch between Candlestick Terminal and TradingView live web chart */
function switchChartView(view) {
  currentChartView = view;
  const tabTv = document.getElementById("tab-btn-tv");
  const tabMl = document.getElementById("tab-btn-ml");
  const tvWrapper = document.getElementById("tv-chart-wrapper");
  const mlWrapper = document.getElementById("ml-chart-wrapper");
  const tvControls = document.getElementById("tv-controls");
  const mlControls = document.getElementById("ml-controls");
  const legendBar = document.getElementById("candle-legend-bar");

  if (view === "tv") {
    if (tabTv) tabTv.classList.add("active");
    if (tabMl) tabMl.classList.remove("active");
    if (tvWrapper) tvWrapper.classList.remove("hidden");
    if (mlWrapper) mlWrapper.classList.add("hidden");
    if (tvControls) tvControls.classList.remove("hidden");
    if (mlControls) mlControls.classList.add("hidden");
    if (legendBar) legendBar.classList.add("hidden");

    if (!tvWidget) {
      initTradingViewWidget(currentTvSymbol);
    }
  } else {
    if (tabTv) tabTv.classList.remove("active");
    if (tabMl) tabMl.classList.add("active");
    if (tvWrapper) tvWrapper.classList.add("hidden");
    if (mlWrapper) mlWrapper.classList.remove("hidden");
    if (tvControls) tvControls.classList.add("hidden");
    if (mlControls) mlControls.classList.remove("hidden");
    if (legendBar) legendBar.classList.remove("hidden");

    if (lwChart) {
      const container = document.getElementById("mlCandleChart");
      if (container && container.clientWidth > 0) {
        lwChart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight || 440
        });
      }
    } else if (priceChart) {
      priceChart.resize();
    }
  }
}

/** Toggle between Candlestick and Line chart presentation */
function setChartStyle(style) {
  currentChartStyle = style;
  const btnCandle = document.getElementById("btn-chart-candlestick");
  const btnLine = document.getElementById("btn-chart-line");

  if (style === "candlestick") {
    if (btnCandle) btnCandle.classList.add("active");
    if (btnLine) btnLine.classList.remove("active");
    if (lwCandleSeries) lwCandleSeries.applyOptions({ visible: true });
    if (lwLineSeries) lwLineSeries.applyOptions({ visible: false });
  } else {
    if (btnCandle) btnCandle.classList.remove("active");
    if (btnLine) btnLine.classList.add("active");
    if (lwCandleSeries) lwCandleSeries.applyOptions({ visible: false });
    if (lwLineSeries) lwLineSeries.applyOptions({ visible: true });
  }
}

/** Update the floating OHLC inspection bar */
function updateLegendBar(bar) {
  if (!bar) return;
  const o = typeof bar.open === "number" ? bar.open : (bar.value ?? 0);
  const h = typeof bar.high === "number" ? bar.high : o;
  const l = typeof bar.low === "number" ? bar.low : o;
  const c = typeof bar.close === "number" ? bar.close : (bar.value ?? o);
  const diff = c - o;
  const pct = o !== 0 ? (diff / o) * 100 : 0;
  const isUp = diff >= 0;

  const openEl = document.getElementById("legend-open");
  const highEl = document.getElementById("legend-high");
  const lowEl = document.getElementById("legend-low");
  const closeEl = document.getElementById("legend-close");
  const chgEl = document.getElementById("legend-change");

  if (openEl) openEl.innerText = `$${o.toFixed(2)}`;
  if (highEl) highEl.innerText = `$${h.toFixed(2)}`;
  if (lowEl) lowEl.innerText = `$${l.toFixed(2)}`;
  if (closeEl) closeEl.innerText = `$${c.toFixed(2)}`;
  if (chgEl) {
    chgEl.innerText = `${isUp ? "+" : ""}$${diff.toFixed(2)} (${isUp ? "+" : ""}${pct.toFixed(2)}%)`;
    chgEl.className = isUp ? "bullish-text" : "bearish-text";
  }
}

/** Safely convert date string into Unix seconds timestamp */
function parseCandleTime(dtStr) {
  if (!dtStr) return 0;
  const clean = dtStr.trim();
  const iso = clean.includes("T") ? clean : clean.replace(" ", "T") + "Z";
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) {
    const fallback = new Date(clean).getTime();
    return isNaN(fallback) ? 0 : Math.floor(fallback / 1000);
  }
  return Math.floor(ms / 1000);
}

/** Update the top ticker metrics */
function updateTicker(latest) {
  document.getElementById("ticker-current-price").innerText = `$${latest.close.toFixed(2)}`;
  
  // Calculate 24h high/low from last 24 candles
  const last24 = cachedCandles.slice(-24);
  const high24 = Math.max(...last24.map(c => c.high));
  const low24 = Math.min(...last24.map(c => c.low));
  document.getElementById("ticker-high-low").innerText = `$${high24.toFixed(2)} / $${low24.toFixed(2)}`;
}

/** Populate simulator form with recent market state */
function populateSimulatorDefaults(latest) {
  document.getElementById("sim-open").value = latest.open.toFixed(2);
  document.getElementById("sim-high").value = latest.high.toFixed(2);
  document.getElementById("sim-low").value = latest.low.toFixed(2);
  document.getElementById("sim-close").value = latest.close.toFixed(2);
}

/** Render Main Interactive Candlestick Chart with Technical Overlays */
function renderPriceChart(candles) {
  if (!candles || candles.length === 0) return;

  // Prefer Lightweight Charts (Financial Candlestick Engine)
  if (typeof LightweightCharts !== "undefined") {
    const container = document.getElementById("mlCandleChart");
    if (!container) return;

    // Filter, deduplicate, and sort candles by time
    const seenTimes = new Set();
    const sortedCandles = [];
    for (const c of candles) {
      const t = parseCandleTime(c.datetime);
      if (t > 0 && !seenTimes.has(t)) {
        seenTimes.add(t);
        sortedCandles.push({
          ...c,
          _time: t,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close)
        });
      }
    }
    sortedCandles.sort((a, b) => a._time - b._time);

    const candleData = sortedCandles.map(c => ({
      time: c._time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));

    const lineData = sortedCandles.map(c => ({
      time: c._time,
      value: c.close
    }));

    const smaData = sortedCandles
      .filter(c => c.sma_20 !== undefined && c.sma_20 !== null)
      .map(c => ({ time: c._time, value: Number(c.sma_20) }));

    const emaData = sortedCandles
      .filter(c => c.ema_50 !== undefined && c.ema_50 !== null)
      .map(c => ({ time: c._time, value: Number(c.ema_50) }));

    const bbUpperData = sortedCandles
      .filter(c => c.bb_upper !== undefined && c.bb_upper !== null)
      .map(c => ({ time: c._time, value: Number(c.bb_upper) }));

    const bbLowerData = sortedCandles
      .filter(c => c.bb_lower !== undefined && c.bb_lower !== null)
      .map(c => ({ time: c._time, value: Number(c.bb_lower) }));

    if (!lwChart) {
      container.innerHTML = "";
      lwChart = LightweightCharts.createChart(container, {
        width: container.clientWidth || 800,
        height: 440,
        layout: {
          background: { type: "solid", color: "#10141e" },
          textColor: "#94a3b8",
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace"
        },
        grid: {
          vertLines: { color: "rgba(255, 255, 255, 0.04)" },
          horzLines: { color: "rgba(255, 255, 255, 0.04)" }
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
          vertLine: {
            color: "rgba(212, 175, 55, 0.4)",
            width: 1,
            style: LightweightCharts.LineStyle.Dashed
          },
          horzLine: {
            color: "rgba(212, 175, 55, 0.4)",
            width: 1,
            style: LightweightCharts.LineStyle.Dashed
          }
        },
        rightPriceScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
          scaleMargins: { top: 0.08, bottom: 0.08 }
        },
        timeScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
          timeVisible: true,
          secondsVisible: false
        },
        handleScroll: true,
        handleScale: true
      });

      // 1. Candlestick series (green/red candles & wicks)
      lwCandleSeries = lwChart.addSeries(LightweightCharts.CandlestickSeries, {
        upColor: "#00c087",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#00c087",
        wickDownColor: "#ef4444"
      });

      // 2. Line series (optional fallback/alternate style)
      lwLineSeries = lwChart.addSeries(LightweightCharts.LineSeries, {
        color: "#d4af37",
        lineWidth: 2,
        visible: false
      });

      // 3. Technical Indicator Overlays
      lwSmaSeries = lwChart.addSeries(LightweightCharts.LineSeries, {
        color: "#00b4d8",
        lineWidth: 1.5,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        title: "SMA 20"
      });

      lwEmaSeries = lwChart.addSeries(LightweightCharts.LineSeries, {
        color: "#9d4edd",
        lineWidth: 1.5,
        title: "EMA 50"
      });

      lwBbUpperSeries = lwChart.addSeries(LightweightCharts.LineSeries, {
        color: "rgba(255, 255, 255, 0.35)",
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dotted,
        title: "BB Upper"
      });

      lwBbLowerSeries = lwChart.addSeries(LightweightCharts.LineSeries, {
        color: "rgba(255, 255, 255, 0.35)",
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dotted,
        title: "BB Lower"
      });

      // Crosshair inspection updates legend bar
      lwChart.subscribeCrosshairMove(param => {
        if (!param || !param.time || !param.seriesData) {
          if (sortedCandles.length > 0) {
            updateLegendBar(sortedCandles[sortedCandles.length - 1]);
          }
          return;
        }
        const candleBar = param.seriesData.get(lwCandleSeries);
        const lineBar = param.seriesData.get(lwLineSeries);
        if (candleBar) {
          updateLegendBar(candleBar);
        } else if (lineBar) {
          updateLegendBar(lineBar);
        }
      });
    }

    // Keep the user's zoom and historical position across live refreshes.
    const scale = lwChart.timeScale();
    const visible = scale.getVisibleRange();
    const logical = scale.getVisibleLogicalRange();
    const oldBars = lwCandleSeries.data().length;
    const following = logical && logical.to >= oldBars - 1;
    const requestedCount = document.getElementById('candle-count-select').value;
    const resetView = displayedChartCount !== requestedCount;
    // Set series data
    lwCandleSeries.setData(candleData);
    lwLineSeries.setData(lineData);
    lwSmaSeries.setData(smaData);
    lwEmaSeries.setData(emaData);
    lwBbUpperSeries.setData(bbUpperData);
    lwBbLowerSeries.setData(bbLowerData);

    // Apply overlay visibility & style
    updateChartDatasets();
    setChartStyle(currentChartStyle);

    if (resetView || !visible) scale.fitContent();
    else if (following && logical) {
      const right = candleData.length - 1 + Math.max(0, logical.to - (oldBars - 1));
      scale.setVisibleLogicalRange({ from: right - (logical.to - logical.from), to: right });
    } else scale.setVisibleRange(visible);
    displayedChartCount = requestedCount;

    // Set legend bar to latest candle
    if (sortedCandles.length > 0) {
      updateLegendBar(sortedCandles[sortedCandles.length - 1]);
    }

    return;
  }

  // Fallback: Chart.js Canvas
  renderChartJsFallback(candles);
}

/** Fallback renderer using Chart.js */
function renderChartJsFallback(candles) {
  const canvas = document.getElementById("priceChart");
  if (!canvas) return;
  canvas.classList.remove("hidden");
  const ctx = canvas.getContext("2d");
  const labels = candles.map(c => c.datetime.split(" ")[1] || c.datetime);
  const closePrices = candles.map(c => c.close);
  const sma20 = candles.map(c => c.sma_20);
  const ema50 = candles.map(c => c.ema_50);
  const bbUpper = candles.map(c => c.bb_upper);
  const bbLower = candles.map(c => c.bb_lower);

  const showSma = document.getElementById("toggle-sma").checked;
  const showEma = document.getElementById("toggle-ema").checked;
  const showBb = document.getElementById("toggle-bb").checked;

  const datasets = [
    {
      label: "Gold Close ($)",
      data: closePrices,
      borderColor: "#d4af37",
      backgroundColor: "rgba(212, 175, 55, 0.08)",
      borderWidth: 2,
      fill: true,
      tension: 0.1,
      pointRadius: 0
    },
    {
      label: "SMA (20)",
      data: sma20,
      borderColor: "#00b4d8",
      borderWidth: 1.5,
      borderDash: [4, 4],
      fill: false,
      pointRadius: 0,
      hidden: !showSma
    },
    {
      label: "EMA (50)",
      data: ema50,
      borderColor: "#9d4edd",
      borderWidth: 1.5,
      fill: false,
      pointRadius: 0,
      hidden: !showEma
    },
    {
      label: "BB Upper",
      data: bbUpper,
      borderColor: "rgba(255, 255, 255, 0.25)",
      borderWidth: 1,
      fill: false,
      pointRadius: 0,
      hidden: !showBb
    },
    {
      label: "BB Lower",
      data: bbLower,
      borderColor: "rgba(255, 255, 255, 0.25)",
      borderWidth: 1,
      fill: "-1",
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      pointRadius: 0,
      hidden: !showBb
    }
  ];

  if (priceChart) {
    priceChart.data.labels = labels;
    priceChart.data.datasets = datasets;
    priceChart.update();
  } else {
    priceChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false }
      }
    });
  }
}

/** Update overlay visibility according to user toggles */
function updateChartDatasets() {
  const showSma = document.getElementById("toggle-sma") ? document.getElementById("toggle-sma").checked : true;
  const showEma = document.getElementById("toggle-ema") ? document.getElementById("toggle-ema").checked : true;
  const showBb = document.getElementById("toggle-bb") ? document.getElementById("toggle-bb").checked : true;

  if (lwChart) {
    if (lwSmaSeries) lwSmaSeries.applyOptions({ visible: showSma });
    if (lwEmaSeries) lwEmaSeries.applyOptions({ visible: showEma });
    if (lwBbUpperSeries) lwBbUpperSeries.applyOptions({ visible: showBb });
    if (lwBbLowerSeries) lwBbLowerSeries.applyOptions({ visible: showBb });
  }

  if (priceChart && priceChart.data && priceChart.data.datasets) {
    if (priceChart.data.datasets[1]) priceChart.data.datasets[1].hidden = !showSma;
    if (priceChart.data.datasets[2]) priceChart.data.datasets[2].hidden = !showEma;
    if (priceChart.data.datasets[3]) priceChart.data.datasets[3].hidden = !showBb;
    if (priceChart.data.datasets[4]) priceChart.data.datasets[4].hidden = !showBb;
    priceChart.update();
  }
}

/** Render Secondary Chart (RSI or MACD) */
function renderIndicatorChart(candles) {
  const ctx = document.getElementById("indicatorChart").getContext("2d");
  const labels = candles.map(c => c.datetime.split(" ")[1] || c.datetime);
  const latest = candles[candles.length - 1];

  let datasets = [];
  let yAxisConfig = {};

  if (currentActiveIndicator === "rsi") {
    const rsiValues = candles.map(c => c.rsi_14);
    document.getElementById("indicator-val").innerText = `RSI: ${latest.rsi_14.toFixed(2)}`;

    datasets = [
      {
        label: "RSI (14)",
        data: rsiValues,
        borderColor: "#f59e0b",
        borderWidth: 1.8,
        pointRadius: 0,
        fill: false
      }
    ];

    yAxisConfig = {
      min: 10,
      max: 90,
      grid: { color: "rgba(255, 255, 255, 0.05)" },
      ticks: { color: "#64748b", stepSize: 20 }
    };
  } else {
    const macdValues = candles.map(c => c.macd);
    const macdSignals = candles.map(c => c.macd_signal);
    document.getElementById("indicator-val").innerText = `MACD: ${latest.macd.toFixed(3)}`;

    datasets = [
      {
        label: "MACD",
        data: macdValues,
        borderColor: "#06b6d4",
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false
      },
      {
        label: "Signal",
        data: macdSignals,
        borderColor: "#ec4899",
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false
      }
    ];

    yAxisConfig = {
      grid: { color: "rgba(255, 255, 255, 0.05)" },
      ticks: { color: "#64748b" }
    };
  }

  if (indicatorChart) {
    indicatorChart.data.labels = labels;
    indicatorChart.data.datasets = datasets;
    indicatorChart.options.scales.y = yAxisConfig;
    indicatorChart.update();
  } else {
    indicatorChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: yAxisConfig
        }
      }
    });
  }
}

