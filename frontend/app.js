/**
 * XAU/USD Gold Price Prediction ML Dashboard
 * Frontend / Chart / TradingView Logic
 */

// ============================================================
// TradingView Configuration
// ============================================================

const DEFAULT_TV_URL =
  "https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD&interval=15";

const DEFAULT_TV_SYMBOL =
  "OANDA:XAUUSD";


let currentTvUrl =
  localStorage.getItem("tv_chart_url") ||
  DEFAULT_TV_URL;

let currentTvSymbol =
  localStorage.getItem("tv_chart_symbol") ||
  DEFAULT_TV_SYMBOL;


let tvWidget = null;

let currentChartView =
  "ml";

let currentChartStyle =
  "candlestick";


// ============================================================
// Lightweight Charts State
// ============================================================

let lwChart = null;
let lwCandleSeries = null;
let lwLineSeries = null;

let lwSmaSeries = null;
let lwEmaSeries = null;

let lwBbUpperSeries = null;
let lwBbLowerSeries = null;


// ============================================================
// Chart.js State
// ============================================================

let priceChart = null;
let indicatorChart = null;


// ============================================================
// Dashboard State
// ============================================================

let currentActiveIndicator =
  "rsi";

let cachedCandles = [];

let displayedChartCount =
  null;


// ============================================================
// DOM Helpers
// ============================================================

function element(id) {
  return document.getElementById(id);
}


// ============================================================
// Initialize
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "[App] Frontend initialized"
    );

    console.log(
      "[App] API:",
      typeof API_BASE !== "undefined"
        ? API_BASE
        : "API_BASE unavailable"
    );


    initEventListeners();


    // dashboard-api.js owns the
    // dashboard refresh.
    if (
      typeof refreshDashboard ===
      "function"
    ) {
      refreshDashboard();
    }


    if (
      typeof loadBenchmarkMetrics ===
      "function"
    ) {
      loadBenchmarkMetrics();
    }
  }
);


// ============================================================
// Event Listeners
// ============================================================

function initEventListeners() {

  // ----------------------------------------------------------
  // Chart Style
  // ----------------------------------------------------------

  const btnCandle =
    element(
      "btn-chart-candlestick"
    );

  const btnLine =
    element(
      "btn-chart-line"
    );


  if (btnCandle) {

    btnCandle.addEventListener(
      "click",
      () => {
        setChartStyle(
          "candlestick"
        );
      }
    );
  }


  if (btnLine) {

    btnLine.addEventListener(
      "click",
      () => {
        setChartStyle(
          "line"
        );
      }
    );
  }


  // ----------------------------------------------------------
  // Chart Tabs
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      ".chart-tab-btn"
    )
    .forEach(
      btn => {

        btn.addEventListener(
          "click",
          event => {

            const targetView =
              event.currentTarget
                .getAttribute(
                  "data-chart"
                );

            switchChartView(
              targetView
            );
          }
        );
      }
    );


  // ----------------------------------------------------------
  // Window Resize
  // ----------------------------------------------------------

  window.addEventListener(
    "resize",
    () => {

      if (!lwChart) {
        return;
      }


      const container =
        element(
          "mlCandleChart"
        );


      if (
        container &&
        container.clientWidth > 0
      ) {

        lwChart.applyOptions({
          width:
            container.clientWidth,

          height:
            container.clientHeight ||
            440
        });
      }
    }
  );


  // ----------------------------------------------------------
  // TradingView Modal
  // ----------------------------------------------------------

  initTradingViewControls();


  // ----------------------------------------------------------
  // Model Selector
  // ----------------------------------------------------------

  const modelSelect =
    element("model-select");


  if (modelSelect) {

    modelSelect.addEventListener(
      "change",
      event => {

        const selected =
          event.target
            .options[
              event.target
                .selectedIndex
            ];


        const modelName =
          selected?.text ||
          event.target.value;


        const ticker =
          element(
            "ticker-active-model"
          );


        if (ticker) {
          ticker.innerText =
            modelName;
        }


        if (
          typeof fetchLatestPrediction ===
          "function"
        ) {
          fetchLatestPrediction();
        }
      }
    );
  }


  // ----------------------------------------------------------
  // Predict Now
  // ----------------------------------------------------------

  const predictButton =
    element(
      "btn-predict-now"
    );


  if (predictButton) {

    predictButton.addEventListener(
      "click",
      () => {

        if (
          typeof fetchLatestPrediction ===
          "function"
        ) {
          fetchLatestPrediction();
        }
      }
    );
  }


  // ----------------------------------------------------------
  // Refresh Data
  // ----------------------------------------------------------

  const refreshButton =
    element(
      "btn-refresh-data"
    );


  if (refreshButton) {

    refreshButton.addEventListener(
      "click",
      () => {

        if (
          typeof refreshDashboard ===
          "function"
        ) {
          refreshDashboard();
        }
      }
    );
  }


  // ----------------------------------------------------------
  // Candle Count
  // ----------------------------------------------------------

  const candleCount =
    element(
      "candle-count-select"
    );


  if (candleCount) {

    candleCount.addEventListener(
      "change",
      () => {

        if (
          typeof loadDashboardData ===
          "function"
        ) {
          loadDashboardData();
        }
      }
    );
  }


  // ----------------------------------------------------------
  // Main Chart Indicators
  // ----------------------------------------------------------

  [
    "toggle-sma",
    "toggle-ema",
    "toggle-bb"
  ].forEach(
    id => {

      const checkbox =
        element(id);


      if (checkbox) {

        checkbox.addEventListener(
          "change",
          updateChartDatasets
        );
      }
    }
  );


  // ----------------------------------------------------------
  // RSI / MACD Tabs
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      ".tab-btn"
    )
    .forEach(
      btn => {

        btn.addEventListener(
          "click",
          event => {

            document
              .querySelectorAll(
                ".tab-btn"
              )
              .forEach(
                b =>
                  b.classList
                    .remove(
                      "active"
                    )
              );


            event.currentTarget
              .classList
              .add("active");


            currentActiveIndicator =
              event.currentTarget
                .getAttribute(
                  "data-target"
                ) ||
              "rsi";


            if (
              typeof Chart !==
              "undefined" &&
              cachedCandles.length
            ) {

              renderIndicatorChart(
                cachedCandles
              );
            }
          }
        );
      }
    );


  // ----------------------------------------------------------
  // Scenario Simulator
  // ----------------------------------------------------------

  const simulatorForm =
    element(
      "simulator-form"
    );


  if (
    simulatorForm &&
    typeof handleScenarioSimulation ===
    "function"
  ) {

    simulatorForm.addEventListener(
      "submit",
      handleScenarioSimulation
    );
  }


  // ----------------------------------------------------------
  // Live API Modal
  // ----------------------------------------------------------

  initLiveApiModal();
}


// ============================================================
// TradingView Controls
// ============================================================

function initTradingViewControls() {

  const tvModal =
    element("tv-modal");

  const openButton =
    element(
      "btn-open-tv-modal"
    );

  const closeButton =
    element(
      "btn-close-tv-modal"
    );

  const cancelButton =
    element(
      "btn-cancel-tv-modal"
    );

  const saveButton =
    element(
      "btn-save-tv-url"
    );

  const urlInput =
    element(
      "modal-tv-url"
    );

  const symbolInput =
    element(
      "modal-tv-symbol"
    );


  if (
    openButton &&
    tvModal
  ) {

    openButton.addEventListener(
      "click",
      () => {

        if (urlInput) {
          urlInput.value =
            currentTvUrl;
        }


        if (symbolInput) {
          symbolInput.value =
            currentTvSymbol;
        }


        const status =
          element(
            "tv-modal-status-msg"
          );


        if (status) {
          status.classList
            .add("hidden");
        }


        tvModal.classList
          .remove("hidden");
      }
    );
  }


  if (
    closeButton &&
    tvModal
  ) {

    closeButton.addEventListener(
      "click",
      () => {
        tvModal.classList
          .add("hidden");
      }
    );
  }


  if (
    cancelButton &&
    tvModal
  ) {

    cancelButton.addEventListener(
      "click",
      () => {
        tvModal.classList
          .add("hidden");
      }
    );
  }


  if (urlInput) {

    urlInput.addEventListener(
      "input",
      event => {

        const extracted =
          extractSymbolFromUrl(
            event.target.value.trim()
          );


        if (
          extracted &&
          symbolInput
        ) {

          symbolInput.value =
            extracted;
        }
      }
    );
  }


  if (saveButton) {

    saveButton.addEventListener(
      "click",
      () => {

        const newUrl =
          urlInput?.value.trim() ||
          DEFAULT_TV_URL;


        const newSymbol =
          symbolInput?.value.trim() ||
          extractSymbolFromUrl(
            newUrl
          );


        currentTvUrl =
          newUrl;

        currentTvSymbol =
          newSymbol;


        localStorage.setItem(
          "tv_chart_url",
          currentTvUrl
        );

        localStorage.setItem(
          "tv_chart_symbol",
          currentTvSymbol
        );


        initTradingViewWidget();


        const status =
          element(
            "tv-modal-status-msg"
          );


        if (status) {

          status.textContent =
            `Connected to ${currentTvSymbol}!`;

          status.className =
            "modal-status success";

          status.classList
            .remove("hidden");
        }


        setTimeout(
          () => {

            if (tvModal) {

              tvModal.classList
                .add("hidden");
            }

          },
          1000
        );
      }
    );
  }
}


// ============================================================
// Extract TradingView Symbol
// ============================================================

function extractSymbolFromUrl(url) {

  try {

    const parsed =
      new URL(url);

    const symbol =
      parsed.searchParams
        .get("symbol");


    if (symbol) {

      return decodeURIComponent(
        symbol
      );
    }

  } catch (error) {

    const match =
      url.match(
        /[?&]symbol=([^&]+)/
      );


    if (match) {

      return decodeURIComponent(
        match[1]
      );
    }
  }


  return DEFAULT_TV_SYMBOL;
}


// ============================================================
// TradingView Widget
// ============================================================

function initTradingViewWidget() {

  const container =
    element(
      "tradingview_widget_container"
    );


  if (!container) {
    return;
  }


  container.replaceChildren();


  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "tradingview-widget-container";

  wrapper.style.cssText =
    "height:100%;width:100%";


  const chart =
    document.createElement(
      "div"
    );

  chart.className =
    "tradingview-widget-container__widget";

  chart.style.cssText =
    "height:calc(100% - 32px);width:100%";


  const credit =
    document.createElement(
      "a"
    );

  credit.href =
    currentTvUrl;

  credit.target =
    "_blank";

  credit.rel =
    "noopener noreferrer";

  credit.textContent =
    `${currentTvSymbol} chart by TradingView · 15 minutes`;


  const script =
    document.createElement(
      "script"
    );

  script.src =
    "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

  script.async = true;


  script.textContent =
    JSON.stringify({
      autosize: true,
      symbol: currentTvSymbol,
      interval: "15",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      hide_side_toolbar: false,
      hide_volume: true,
      calendar: true,
      details: true,
      withdateranges: true
    });


  script.onerror =
    () => {

      credit.textContent =
        "TradingView unavailable here. Open the XAUUSD chart directly.";
    };


  wrapper.append(
    chart,
    credit,
    script
  );


  container.appendChild(
    wrapper
  );


  tvWidget = true;
}


// ============================================================
// Switch Chart View
// ============================================================

function switchChartView(view) {

  currentChartView =
    view === "tv"
      ? "tv"
      : "ml";


  const tabTv =
    element("tab-btn-tv");

  const tabMl =
    element("tab-btn-ml");

  const tvWrapper =
    element("tv-chart-wrapper");

  const mlWrapper =
    element("ml-chart-wrapper");

  const tvControls =
    element("tv-controls");

  const mlControls =
    element("ml-controls");

  const legendBar =
    element("candle-legend-bar");


  if (
    currentChartView ===
    "tv"
  ) {

    tabTv?.classList
      .add("active");

    tabMl?.classList
      .remove("active");

    tvWrapper?.classList
      .remove("hidden");

    mlWrapper?.classList
      .add("hidden");

    tvControls?.classList
      .remove("hidden");

    mlControls?.classList
      .add("hidden");

    legendBar?.classList
      .add("hidden");


    if (!tvWidget) {

      initTradingViewWidget();
    }

  } else {

    tabTv?.classList
      .remove("active");

    tabMl?.classList
      .add("active");

    tvWrapper?.classList
      .add("hidden");

    mlWrapper?.classList
      .remove("hidden");

    tvControls?.classList
      .add("hidden");

    mlControls?.classList
      .remove("hidden");

    legendBar?.classList
      .remove("hidden");


    if (lwChart) {

      const container =
        element(
          "mlCandleChart"
        );


      if (
        container &&
        container.clientWidth > 0
      ) {

        lwChart.applyOptions({
          width:
            container.clientWidth,

          height:
            container.clientHeight ||
            440
        });
      }

    } else if (priceChart) {

      priceChart.resize();
    }
  }
}


// ============================================================
// Chart Style
// ============================================================

function setChartStyle(style) {

  currentChartStyle =
    style === "line"
      ? "line"
      : "candlestick";


  const btnCandle =
    element(
      "btn-chart-candlestick"
    );

  const btnLine =
    element(
      "btn-chart-line"
    );


  if (
    currentChartStyle ===
    "candlestick"
  ) {

    btnCandle?.classList
      .add("active");

    btnLine?.classList
      .remove("active");


    lwCandleSeries?.applyOptions({
      visible: true
    });

    lwLineSeries?.applyOptions({
      visible: false
    });

  } else {

    btnCandle?.classList
      .remove("active");

    btnLine?.classList
      .add("active");


    lwCandleSeries?.applyOptions({
      visible: false
    });

    lwLineSeries?.applyOptions({
      visible: true
    });
  }
}


// ============================================================
// Legend Bar
// ============================================================

function updateLegendBar(bar) {

  if (!bar) {
    return;
  }


  const open =
    typeof bar.open === "number"
      ? bar.open
      : Number(bar.value ?? 0);

  const high =
    typeof bar.high === "number"
      ? bar.high
      : open;

  const low =
    typeof bar.low === "number"
      ? bar.low
      : open;

  const close =
    typeof bar.close === "number"
      ? bar.close
      : Number(bar.value ?? open);


  const diff =
    close - open;

  const pct =
    open !== 0
      ? (diff / open) * 100
      : 0;

  const isUp =
    diff >= 0;


  const openEl =
    element("legend-open");

  const highEl =
    element("legend-high");

  const lowEl =
    element("legend-low");

  const closeEl =
    element("legend-close");

  const changeEl =
    element("legend-change");


  if (openEl) {
    openEl.innerText =
      `$${open.toFixed(2)}`;
  }

  if (highEl) {
    highEl.innerText =
      `$${high.toFixed(2)}`;
  }

  if (lowEl) {
    lowEl.innerText =
      `$${low.toFixed(2)}`;
  }

  if (closeEl) {
    closeEl.innerText =
      `$${close.toFixed(2)}`;
  }


  if (changeEl) {

    changeEl.innerText =
      `${isUp ? "+" : ""}$${diff.toFixed(2)} (${isUp ? "+" : ""}${pct.toFixed(2)}%)`;

    changeEl.className =
      isUp
        ? "bullish-text"
        : "bearish-text";
  }
}


// ============================================================
// Candle Time
// ============================================================

function parseCandleTime(dtStr) {

  if (!dtStr) {
    return 0;
  }


  const clean =
    String(dtStr).trim();


  const iso =
    clean.includes("T")
      ? clean
      : `${clean.replace(" ", "T")}Z`;


  const ms =
    new Date(iso).getTime();


  if (
    Number.isNaN(ms)
  ) {

    const fallback =
      new Date(clean).getTime();


    return Number.isNaN(
      fallback
    )
      ? 0
      : Math.floor(
          fallback / 1000
        );
  }


  return Math.floor(
    ms / 1000
  );
}


// ============================================================
// Ticker
// ============================================================

function updateTicker(latest) {

  if (!latest) {
    return;
  }


  const close =
    Number(latest.close);


  if (
    Number.isFinite(close)
  ) {

    const price =
      element(
        "ticker-current-price"
      );


    if (price) {

      price.innerText =
        `$${close.toFixed(2)}`;
    }
  }


  const last24 =
    cachedCandles.slice(-24);


  if (!last24.length) {
    return;
  }


  const highs =
    last24
      .map(
        c => Number(c.high)
      )
      .filter(
        Number.isFinite
      );


  const lows =
    last24
      .map(
        c => Number(c.low)
      )
      .filter(
        Number.isFinite
      );


  if (
    highs.length &&
    lows.length
  ) {

    const high24 =
      Math.max(...highs);

    const low24 =
      Math.min(...lows);


    const ticker =
      element(
        "ticker-high-low"
      );


    if (ticker) {

      ticker.innerText =
        `$${high24.toFixed(2)} / $${low24.toFixed(2)}`;
    }
  }
}


// ============================================================
// Simulator Defaults
// ============================================================

function populateSimulatorDefaults(
  latest
) {

  if (!latest) {
    return;
  }


  [
    "open",
    "high",
    "low",
    "close"
  ].forEach(
    name => {

      const input =
        element(
          `sim-${name}`
        );


      const value =
        Number(
          latest[name]
        );


      if (
        input &&
        Number.isFinite(value)
      ) {

        input.value =
          value.toFixed(2);
      }
    }
  );
}


// ============================================================
// Main Price Chart
// ============================================================

function renderPriceChart(
  candles
) {

  if (
    !candles ||
    !candles.length
  ) {
    return;
  }


  // ----------------------------------------------------------
  // Lightweight Charts
  // ----------------------------------------------------------

  if (
    typeof LightweightCharts !==
    "undefined"
  ) {

    const container =
      element(
        "mlCandleChart"
      );


    if (!container) {
      return;
    }


    const seenTimes =
      new Set();

    const sortedCandles =
      [];


    for (
      const candle
      of candles
    ) {

      const time =
        parseCandleTime(
          candle.datetime
        );


      if (
        time > 0 &&
        !seenTimes.has(time)
      ) {

        seenTimes.add(time);


        sortedCandles.push({
          ...candle,

          _time: time,

          open:
            Number(candle.open),

          high:
            Number(candle.high),

          low:
            Number(candle.low),

          close:
            Number(candle.close)
        });
      }
    }


    sortedCandles.sort(
      (a, b) =>
        a._time - b._time
    );


    if (
      !sortedCandles.length
    ) {
      return;
    }


    const candleData =
      sortedCandles.map(
        candle => ({
          time:
            candle._time,

          open:
            candle.open,

          high:
            candle.high,

          low:
            candle.low,

          close:
            candle.close
        })
      );


    const lineData =
      sortedCandles.map(
        candle => ({
          time:
            candle._time,

          value:
            candle.close
        })
      );


    const smaData =
      sortedCandles
        .filter(
          candle =>
            candle.sma_20 !==
              undefined &&
            candle.sma_20 !==
              null &&
            Number.isFinite(
              Number(
                candle.sma_20
              )
            )
        )
        .map(
          candle => ({
            time:
              candle._time,

            value:
              Number(
                candle.sma_20
              )
          })
        );


    const emaData =
      sortedCandles
        .filter(
          candle =>
            candle.ema_50 !==
              undefined &&
            candle.ema_50 !==
              null &&
            Number.isFinite(
              Number(
                candle.ema_50
              )
            )
        )
        .map(
          candle => ({
            time:
              candle._time,

            value:
              Number(
                candle.ema_50
              )
          })
        );


    const bbUpperData =
      sortedCandles
        .filter(
          candle =>
            candle.bb_upper !==
              undefined &&
            candle.bb_upper !==
              null &&
            Number.isFinite(
              Number(
                candle.bb_upper
              )
            )
        )
        .map(
          candle => ({
            time:
              candle._time,

            value:
              Number(
                candle.bb_upper
              )
          })
        );


    const bbLowerData =
      sortedCandles
        .filter(
          candle =>
            candle.bb_lower !==
              undefined &&
            candle.bb_lower !==
              null &&
            Number.isFinite(
              Number(
                candle.bb_lower
              )
            )
        )
        .map(
          candle => ({
            time:
              candle._time,

            value:
              Number(
                candle.bb_lower
              )
          })
        );


    // --------------------------------------------------------
    // Create Chart Once
    // --------------------------------------------------------

    if (!lwChart) {

      container.innerHTML =
        "";


      lwChart =
        LightweightCharts
          .createChart(
            container,
            {
              width:
                container.clientWidth ||
                800,

              height: 440,

              layout: {
                background: {
                  type:
                    "solid",

                  color:
                    "#10141e"
                },

                textColor:
                  "#94a3b8",

                fontSize:
                  12,

                fontFamily:
                  "'JetBrains Mono', monospace"
              },

              grid: {
                vertLines: {
                  color:
                    "rgba(255,255,255,0.04)"
                },

                horzLines: {
                  color:
                    "rgba(255,255,255,0.04)"
                }
              },

              crosshair: {
                mode:
                  LightweightCharts
                    .CrosshairMode
                    .Normal,

                vertLine: {
                  color:
                    "rgba(212,175,55,0.4)",

                  width: 1,

                  style:
                    LightweightCharts
                      .LineStyle
                      .Dashed
                },

                horzLine: {
                  color:
                    "rgba(212,175,55,0.4)",

                  width: 1,

                  style:
                    LightweightCharts
                      .LineStyle
                      .Dashed
                }
              },

              rightPriceScale: {
                borderColor:
                  "rgba(255,255,255,0.1)",

                scaleMargins: {
                  top: 0.08,
                  bottom: 0.08
                }
              },

              timeScale: {
                borderColor:
                  "rgba(255,255,255,0.1)",

                timeVisible:
                  true,

                secondsVisible:
                  false
              },

              handleScroll:
                true,

              handleScale:
                true
            }
          );


      // Candles

      lwCandleSeries =
        lwChart.addSeries(
          LightweightCharts
            .CandlestickSeries,
          {
            upColor:
              "#00c087",

            downColor:
              "#ef4444",

            borderVisible:
              false,

            wickUpColor:
              "#00c087",

            wickDownColor:
              "#ef4444"
          }
        );


      // Line

      lwLineSeries =
        lwChart.addSeries(
          LightweightCharts
            .LineSeries,
          {
            color:
              "#d4af37",

            lineWidth:
              2,

            visible:
              false
          }
        );


      // SMA

      lwSmaSeries =
        lwChart.addSeries(
          LightweightCharts
            .LineSeries,
          {
            color:
              "#00b4d8",

            lineWidth:
              1.5,

            lineStyle:
              LightweightCharts
                .LineStyle
                .Dashed,

            title:
              "SMA 20"
          }
        );


      // EMA

      lwEmaSeries =
        lwChart.addSeries(
          LightweightCharts
            .LineSeries,
          {
            color:
              "#9d4edd",

            lineWidth:
              1.5,

            title:
              "EMA 50"
          }
        );


      // BB Upper

      lwBbUpperSeries =
        lwChart.addSeries(
          LightweightCharts
            .LineSeries,
          {
            color:
              "rgba(255,255,255,0.35)",

            lineWidth:
              1,

            lineStyle:
              LightweightCharts
                .LineStyle
                .Dotted,

            title:
              "BB Upper"
          }
        );


      // BB Lower

      lwBbLowerSeries =
        lwChart.addSeries(
          LightweightCharts
            .LineSeries,
          {
            color:
              "rgba(255,255,255,0.35)",

            lineWidth:
              1,

            lineStyle:
              LightweightCharts
                .LineStyle
                .Dotted,

            title:
              "BB Lower"
          }
        );


      // Crosshair

      lwChart.subscribeCrosshairMove(
        param => {

          if (
            !param ||
            !param.time ||
            !param.seriesData
          ) {

            updateLegendBar(
              sortedCandles[
                sortedCandles.length - 1
              ]
            );

            return;
          }


          const candleBar =
            param.seriesData.get(
              lwCandleSeries
            );


          const lineBar =
            param.seriesData.get(
              lwLineSeries
            );


          if (candleBar) {

            updateLegendBar(
              candleBar
            );

          } else if (lineBar) {

            updateLegendBar(
              lineBar
            );
          }
        }
      );
    }


    // --------------------------------------------------------
    // Preserve Zoom
    // --------------------------------------------------------

    const scale =
      lwChart.timeScale();


    const visible =
      scale.getVisibleRange();


    const logical =
      scale.getVisibleLogicalRange();


    let oldBars = 0;


    try {

      oldBars =
        lwCandleSeries.data()
          .length;

    } catch (_) {

      oldBars = 0;
    }


    const following =
      logical &&
      logical.to >=
        oldBars - 1;


    const selector =
      element(
        "candle-count-select"
      );


    const requestedCount =
      selector?.value ||
      String(candles.length);


    const resetView =
      displayedChartCount !==
      requestedCount;


    // --------------------------------------------------------
    // Update Data
    // --------------------------------------------------------

    lwCandleSeries.setData(
      candleData
    );

    lwLineSeries.setData(
      lineData
    );

    lwSmaSeries.setData(
      smaData
    );

    lwEmaSeries.setData(
      emaData
    );

    lwBbUpperSeries.setData(
      bbUpperData
    );

    lwBbLowerSeries.setData(
      bbLowerData
    );


    updateChartDatasets();

    setChartStyle(
      currentChartStyle
    );


    if (
      resetView ||
      !visible
    ) {

      scale.fitContent();

    } else if (
      following &&
      logical
    ) {

      const right =
        candleData.length -
        1 +
        Math.max(
          0,
          logical.to -
            (oldBars - 1)
        );


      scale.setVisibleLogicalRange({
        from:
          right -
          (
            logical.to -
            logical.from
          ),

        to:
          right
      });

    } else {

      scale.setVisibleRange(
        visible
      );
    }


    displayedChartCount =
      requestedCount;


    updateLegendBar(
      sortedCandles[
        sortedCandles.length - 1
      ]
    );


    return;
  }


  // ----------------------------------------------------------
  // Chart.js Fallback
  // ----------------------------------------------------------

  renderChartJsFallback(
    candles
  );
}


// ============================================================
// Chart.js Fallback
// ============================================================

function renderChartJsFallback(
  candles
) {

  const canvas =
    element(
      "priceChart"
    );


  if (!canvas) {
    return;
  }


  canvas.classList
    .remove("hidden");


  const ctx =
    canvas.getContext(
      "2d"
    );


  const labels =
    candles.map(
      candle => {

        const datetime =
          String(
            candle.datetime ||
            ""
          );

        return (
          datetime.split(" ")[1] ||
          datetime
        );
      }
    );


  const closePrices =
    candles.map(
      candle =>
        Number(candle.close)
    );


  const sma20 =
    candles.map(
      candle =>
        candle.sma_20
    );


  const ema50 =
    candles.map(
      candle =>
        candle.ema_50
    );


  const bbUpper =
    candles.map(
      candle =>
        candle.bb_upper
    );


  const bbLower =
    candles.map(
      candle =>
        candle.bb_lower
    );


  const showSma =
    element(
      "toggle-sma"
    )?.checked ?? true;


  const showEma =
    element(
      "toggle-ema"
    )?.checked ?? true;


  const showBb =
    element(
      "toggle-bb"
    )?.checked ?? true;


  const datasets = [

    {
      label:
        "Gold Close ($)",

      data:
        closePrices,

      borderColor:
        "#d4af37",

      backgroundColor:
        "rgba(212,175,55,0.08)",

      borderWidth:
        2,

      fill:
        true,

      tension:
        0.1,

      pointRadius:
        0
    },

    {
      label:
        "SMA (20)",

      data:
        sma20,

      borderColor:
        "#00b4d8",

      borderWidth:
        1.5,

      borderDash:
        [4, 4],

      fill:
        false,

      pointRadius:
        0,

      hidden:
        !showSma
    },

    {
      label:
        "EMA (50)",

      data:
        ema50,

      borderColor:
        "#9d4edd",

      borderWidth:
        1.5,

      fill:
        false,

      pointRadius:
        0,

      hidden:
        !showEma
    },

    {
      label:
        "BB Upper",

      data:
        bbUpper,

      borderColor:
        "rgba(255,255,255,0.25)",

      borderWidth:
        1,

      fill:
        false,

      pointRadius:
        0,

      hidden:
        !showBb
    },

    {
      label:
        "BB Lower",

      data:
        bbLower,

      borderColor:
        "rgba(255,255,255,0.25)",

      borderWidth:
        1,

      fill:
        "-1",

      backgroundColor:
        "rgba(255,255,255,0.02)",

      pointRadius:
        0,

      hidden:
        !showBb
    }
  ];


  if (priceChart) {

    priceChart.data.labels =
      labels;

    priceChart.data.datasets =
      datasets;

    priceChart.update();

  } else {

    priceChart =
      new Chart(
        ctx,
        {
          type:
            "line",

          data: {
            labels,
            datasets
          },

          options: {
            responsive:
              true,

            maintainAspectRatio:
              false,

            interaction: {
              mode:
                "index",

              intersect:
                false
            }
          }
        }
      );
  }
}


// ============================================================
// Indicator Chart
// ============================================================

function renderIndicatorChart(
  candles
) {

  const canvas =
    element(
      "indicatorChart"
    );


  if (
    !canvas ||
    typeof Chart ===
      "undefined"
  ) {
    return;
  }


  const ctx =
    canvas.getContext(
      "2d"
    );


  const labels =
    candles.map(
      candle => {

        const datetime =
          String(
            candle.datetime ||
            ""
          );

        return (
          datetime.split(" ")[1] ||
          datetime
        );
      }
    );


  const latest =
    candles[
      candles.length - 1
    ];


  if (!latest) {
    return;
  }


  let datasets = [];
  let yAxisConfig = {};


  // ----------------------------------------------------------
  // RSI
  // ----------------------------------------------------------

  if (
    currentActiveIndicator ===
    "rsi"
  ) {

    const rsiValues =
      candles.map(
        candle =>
          Number(candle.rsi_14)
      );


    const latestRsi =
      Number(
        latest.rsi_14
      );


    if (
      Number.isFinite(
        latestRsi
      )
    ) {

      const indicatorValue =
        element(
          "indicator-val"
        );


      if (indicatorValue) {

        indicatorValue.innerText =
          `RSI: ${latestRsi.toFixed(2)}`;
      }
    }


    datasets = [
      {
        label:
          "RSI (14)",

        data:
          rsiValues,

        borderColor:
          "#f59e0b",

        borderWidth:
          1.8,

        pointRadius:
          0,

        fill:
          false
      }
    ];


    yAxisConfig = {

      min:
        10,

      max:
        90,

      grid: {
        color:
          "rgba(255,255,255,0.05)"
      },

      ticks: {
        color:
          "#64748b",

        stepSize:
          20
      }
    };


  // ----------------------------------------------------------
  // MACD
  // ----------------------------------------------------------

  } else {

    const macdValues =
      candles.map(
        candle =>
          Number(
            candle.macd
          )
      );


    const macdSignals =
      candles.map(
        candle =>
          Number(
            candle.macd_signal
          )
      );


    const latestMacd =
      Number(
        latest.macd
      );


    if (
      Number.isFinite(
        latestMacd
      )
    ) {

      const indicatorValue =
        element(
          "indicator-val"
        );


      if (indicatorValue) {

        indicatorValue.innerText =
          `MACD: ${latestMacd.toFixed(3)}`;
      }
    }


    datasets = [

      {
        label:
          "MACD",

        data:
          macdValues,

        borderColor:
          "#06b6d4",

        borderWidth:
          1.5,

        pointRadius:
          0,

        fill:
          false
      },

      {
        label:
          "Signal",

        data:
          macdSignals,

        borderColor:
          "#ec4899",

        borderWidth:
          1.5,

        pointRadius:
          0,

        fill:
          false
      }
    ];


    yAxisConfig = {

      grid: {
        color:
          "rgba(255,255,255,0.05)"
      },

      ticks: {
        color:
          "#64748b"
      }
    };
  }


  // ----------------------------------------------------------
  // Update Existing Chart
  // ----------------------------------------------------------

  if (indicatorChart) {

    indicatorChart.data.labels =
      labels;

    indicatorChart.data.datasets =
      datasets;

    indicatorChart.options.scales.y =
      yAxisConfig;

    indicatorChart.update();

  } else {

    indicatorChart =
      new Chart(
        ctx,
        {
          type:
            "line",

          data: {
            labels,
            datasets
          },

          options: {

            responsive:
              true,

            maintainAspectRatio:
              false,

            plugins: {
              legend: {
                display:
                  false
              }
            },

            scales: {

              x: {
                display:
                  false
              },

              y:
                yAxisConfig
            }
          }
        }
      );
  }
}


// ============================================================
// Indicator Visibility
// ============================================================

function updateChartDatasets() {

  const showSma =
    element(
      "toggle-sma"
    )?.checked ?? true;


  const showEma =
    element(
      "toggle-ema"
    )?.checked ?? true;


  const showBb =
    element(
      "toggle-bb"
    )?.checked ?? true;


  if (lwChart) {

    lwSmaSeries?.applyOptions({
      visible:
        showSma
    });


    lwEmaSeries?.applyOptions({
      visible:
        showEma
    });


    lwBbUpperSeries?.applyOptions({
      visible:
        showBb
    });


    lwBbLowerSeries?.applyOptions({
      visible:
        showBb
    });
  }


  if (
    priceChart &&
    priceChart.data &&
    priceChart.data.datasets
  ) {

    if (
      priceChart.data.datasets[1]
    ) {

      priceChart.data.datasets[1]
        .hidden =
        !showSma;
    }


    if (
      priceChart.data.datasets[2]
    ) {

      priceChart.data.datasets[2]
        .hidden =
        !showEma;
    }


    if (
      priceChart.data.datasets[3]
    ) {

      priceChart.data.datasets[3]
        .hidden =
        !showBb;
    }


    if (
      priceChart.data.datasets[4]
    ) {

      priceChart.data.datasets[4]
        .hidden =
        !showBb;
    }


    priceChart.update();
  }
}


// ============================================================
// Live API Modal
// ============================================================

function initLiveApiModal() {

  const modal =
    element(
      "api-modal"
    );

  const openButton =
    element(
      "btn-open-api-modal"
    );

  const closeButton =
    element(
      "btn-close-modal"
    );

  const cancelButton =
    element(
      "btn-cancel-modal"
    );

  const saveButton =
    element(
      "btn-save-fetch-api"
    );


  if (
    openButton &&
    modal
  ) {

    openButton.addEventListener(
      "click",
      () => {
        modal.classList
          .remove("hidden");
      }
    );
  }


  if (
    closeButton &&
    modal
  ) {

    closeButton.addEventListener(
      "click",
      () => {
        modal.classList
          .add("hidden");
      }
    );
  }


  if (
    cancelButton &&
    modal
  ) {

    cancelButton.addEventListener(
      "click",
      () => {
        modal.classList
          .add("hidden");
      }
    );
  }


  if (
    saveButton &&
    typeof handleTwelveDataFetch ===
      "function"
  ) {

    saveButton.addEventListener(
      "click",
      handleTwelveDataFetch
    );
  }
}