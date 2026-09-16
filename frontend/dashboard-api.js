// ============================================================
// XAU/USD Predictive Analytics
// API + Dashboard State
// ============================================================

let latestForecast = null;
let refreshRunning = false;
let trainingTimer = null;
let chartLoading = false;
let lastChartResponse = 0;

// ------------------------------------------------------------
// API BASE
// ------------------------------------------------------------
// Dashboard is normally served by FastAPI itself.
// If frontend is opened from another localhost development
// server, automatically use the FastAPI backend on port 8765.
// ------------------------------------------------------------

const API_BASE = (() => {
  const hostname = window.location.hostname;

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return "http://127.0.0.1:8765";
  }

  return window.location.origin;
})();

console.log("[API] Base URL:", API_BASE);


// ============================================================
// Generic API Request
// ============================================================

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;

  console.log(`[API] ${options.method || "GET"} ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(35000),
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    const contentType =
      response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();

      throw new Error(
        `API returned non-JSON response (${response.status}): ${text.slice(0, 200)}`
      );
    }

    if (!response.ok) {
      const detail =
        typeof data?.detail === "string"
          ? data.detail
          : typeof data?.reason === "string"
            ? data.reason
            : `Request failed with HTTP ${response.status}`;

      throw new Error(detail);
    }

    return data;

  } catch (error) {

    console.error(`[API ERROR] ${url}`, error);

    if (error?.name === "TimeoutError") {
      throw new Error(`Request timeout: ${path}`);
    }

    if (error?.name === "AbortError") {
      throw new Error(`Request aborted: ${path}`);
    }

    if (error instanceof TypeError) {
      throw new Error(
        `Failed to fetch ${url}. Make sure the backend is running on port 8765.`
      );
    }

    throw error;
  }
}


// ============================================================
// DOM Helpers
// ============================================================

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent =
      value === undefined || value === null
        ? "--"
        : String(value);
  }
}


function getElement(id) {
  return document.getElementById(id);
}


// ============================================================
// Number Helpers
// ============================================================

function safeNumber(value, fallback = null) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


function formatNumber(value, digits = 2, fallback = "--") {
  const number = safeNumber(value);

  return number === null
    ? fallback
    : number.toFixed(digits);
}


function formatPrice(value, digits = 2) {
  const number = safeNumber(value);

  return number === null
    ? "--"
    : `$${number.toFixed(digits)}`;
}


// ============================================================
// UTC Date Formatter
// ============================================================

function utc(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return (
    date.toLocaleString("en-GB", {
      timeZone: "UTC",
      hour12: false
    }) + " UTC"
  );
}


// ============================================================
// Forecast Unavailable
// ============================================================

function showUnavailable(message = "Forecast unavailable") {

  latestForecast = null;

  const badge = getElement("signal-badge");

  if (badge) {
    badge.textContent = "UNAVAILABLE";
    badge.className = "signal-badge neutral";
  }

  setText("forecast-status", message);
  setText("pred-price", "--");
  setText("pred-change", "--");
  setText("forecast-window", "--");
  setText("risk-levels", "--");
  setText("ticker-active-model", "No active model");

  for (const id of [
    "metric-rsi",
    "metric-macd",
    "metric-sma",
    "metric-ema"
  ]) {
    setText(id, "--");
  }
}


// ============================================================
// Latest 15-Minute Prediction
// ============================================================

async function fetchLatestPrediction() {

  try {

    const data = await api("/api/predict/latest");

    console.log("[PREDICTION]", data);

    if (!data || data.status !== "ok") {

      showUnavailable(
        data?.reason ||
        data?.message ||
        "15-minute forecast unavailable"
      );

      return;
    }

    latestForecast = data;

    // --------------------------------------------------------
    // Direction
    // --------------------------------------------------------

    const direction =
      String(data.direction || "").toUpperCase();

    const signal =
      String(data.signal || "neutral").toLowerCase();

    const badge = getElement("signal-badge");

    if (badge) {

      badge.textContent =
        direction === "UP"
          ? "UP ▲"
          : direction === "DOWN"
            ? "DOWN ▼"
            : "NEUTRAL";

      badge.className =
        `signal-badge ${signal}`;
    }


    // --------------------------------------------------------
    // Current price
    // --------------------------------------------------------

    const currentClose =
      safeNumber(data.current_close);

    setText(
      "pred-price",
      currentClose === null
        ? "--"
        : `$${currentClose.toFixed(2)}`
    );


    // --------------------------------------------------------
    // Model Scores
    // --------------------------------------------------------

    const upScore =
      safeNumber(data.up_score);

    const downScore =
      safeNumber(data.down_score);

    if (upScore !== null && downScore !== null) {

      setText(
        "pred-change",
        `Model scores: UP ${(upScore * 100).toFixed(1)}% · DOWN ${(downScore * 100).toFixed(1)}%`
      );

    } else {

      setText(
        "pred-change",
        "Probability unavailable for this model"
      );
    }


    // --------------------------------------------------------
    // Forecast Window
    // --------------------------------------------------------

    setText(
      "forecast-window",
      `${utc(data.as_of)} → ${utc(data.forecast_end)}`
    );


    // --------------------------------------------------------
    // Forecast Status
    // --------------------------------------------------------

    const validationWarning =
      data.validation_warning || "";

    const scoreLabel =
      data.score_label || "";

    const modelAgeMessage =
      safeNumber(data.model_age_days, 0) > 7
        ? " Model is over 7 days old; refresh data and retrain."
        : "";

    const marketError =
      data.market?.error
        ? ` Latest refresh failed: ${data.market.error}`
        : "";

    const statusMessage =
      `${validationWarning} ${scoreLabel}${modelAgeMessage}${marketError}`.trim();

    setText(
      "forecast-status",
      statusMessage || "15-minute model prediction available."
    );


    // --------------------------------------------------------
    // Active Model
    // --------------------------------------------------------

    const modelName =
      data.model ||
      "Validated 15-minute model";

    setText(
      "ticker-active-model",
      `${modelName} · 15 min`
    );


    // --------------------------------------------------------
    // Technical Indicators
    // --------------------------------------------------------

    const indicators =
      data.indicators || {};


    // RSI 14

    const rsi =
      safeNumber(indicators.rsi_14);

    setText(
      "metric-rsi",
      rsi === null
        ? "--"
        : rsi.toFixed(1)
    );


    // MACD

    const macd =
      safeNumber(indicators.macd);

    setText(
      "metric-macd",
      macd === null
        ? "--"
        : macd.toFixed(2)
    );


    // SMA 20

    const sma =
      safeNumber(indicators.sma_20);

    setText(
      "metric-sma",
      sma === null
        ? "--"
        : `$${sma.toFixed(1)}`
    );


    // EMA 50

    const ema =
      safeNumber(indicators.ema_50);

    setText(
      "metric-ema",
      ema === null
        ? "--"
        : `$${ema.toFixed(1)}`
    );


    // --------------------------------------------------------
    // Risk Levels
    // --------------------------------------------------------

    const stopLoss =
      safeNumber(data.risk_example?.stop_loss);

    const takeProfit =
      safeNumber(data.risk_example?.take_profit);

    if (
      stopLoss !== null &&
      takeProfit !== null
    ) {

      setText(
        "risk-levels",
        `ATR example: stop $${stopLoss.toFixed(2)} · target $${takeProfit.toFixed(2)}. Excludes spread and slippage.`
      );

    } else {

      setText(
        "risk-levels",
        "Risk levels unavailable."
      );
    }

  } catch (error) {

    console.error(
      "[Prediction Error]",
      error
    );

    showUnavailable(
      error.message ||
      "Failed to load 15-minute prediction"
    );
  }
}


// ============================================================
// Chart Data
// ============================================================

async function loadDashboardData() {

  if (chartLoading) {
    return;
  }

  chartLoading = true;

  try {

    const selector =
      getElement("candle-count-select");

    const limit =
      selector?.value || "100";

    const data =
      await api(`/api/chart?limit=${encodeURIComponent(limit)}`);

    console.log("[CHART]", data);

    lastChartResponse = Date.now();

    cachedCandles =
      Array.isArray(data.candles)
        ? data.candles
        : [];


    // --------------------------------------------------------
    // Status
    // --------------------------------------------------------

    setText(
      "status-text",
      data.live
        ? "Live chart · 15s refresh"
        : "Chart delayed / market closed"
    );


    setText(
      "data-source",
      `${data.source || "Unknown source"} · ${data.interval || "15m"}`
    );


    setText(
      "data-timestamp",
      `Provider fetched: ${utc(data.fetched_at)}. Candle opened: ${utc(data.last_candle_at)}. ${
        data.error ||
        (
          data.forming
            ? "Latest candle is forming; its price and indicators can change. Predictions use completed candles."
            : "No current forming candle available."
        )
      }`
    );


    setText(
      "chart-symbol-badge",
      `XAU/USD · ${data.interval || "15m"}`
    );


    setText(
      "legend-interval",
      `XAU/USD ${data.interval || "15m"}`
    );


    // --------------------------------------------------------
    // Candle Data
    // --------------------------------------------------------

    if (cachedCandles.length > 0) {

      const latest =
        cachedCandles[cachedCandles.length - 1];

      const latestClose =
        safeNumber(latest.close);

      if (latestClose !== null) {

        setText(
          "ticker-current-price",
          `$${latestClose.toFixed(2)}`
        );
      }


      const high24 =
        safeNumber(data.high_24h);

      const low24 =
        safeNumber(data.low_24h);

      if (
        high24 !== null &&
        low24 !== null
      ) {

        setText(
          "ticker-high-low",
          `$${high24.toFixed(2)} / $${low24.toFixed(2)}`
        );

      } else {

        updateTicker(latest);
      }


      const simOpen =
        getElement("sim-open");

      if (
        simOpen &&
        !simOpen.value
      ) {
        populateSimulatorDefaults(latest);
      }


      renderPriceChart(cachedCandles);


      if (
        typeof Chart !== "undefined"
      ) {

        renderIndicatorChart(
          cachedCandles
        );

      } else {

        setText(
          "indicator-val",
          "Indicator chart library unavailable; numeric indicators remain available."
        );
      }

    } else {

      setText(
        "ticker-current-price",
        "--"
      );

      setText(
        "ticker-high-low",
        "--"
      );
    }

  } catch (error) {

    console.error(
      "[Chart Error]",
      error
    );

    setText(
      "status-text",
      "Data unavailable"
    );

    setText(
      "data-timestamp",
      error.message ||
      "Unable to load chart data."
    );

  } finally {

    chartLoading = false;
  }
}


// ============================================================
// Dashboard Refresh
// ============================================================

async function refreshDashboard() {

  if (refreshRunning) {
    return;
  }

  refreshRunning = true;

  try {

    await Promise.all([
      loadDashboardData(),
      fetchLatestPrediction()
    ]);

  } finally {

    refreshRunning = false;
  }
}


// ============================================================
// Scenario Price Simulator
// ============================================================

async function handleScenarioSimulation(event) {

  event.preventDefault();

  const names = [
    "open",
    "high",
    "low",
    "close"
  ];

  const payload = {};

  for (const name of names) {

    const element =
      getElement(`sim-${name}`);

    const value =
      Number(element?.value);

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {

      setText(
        "sim-res-price",
        `Invalid ${name} price`
      );

      setText(
        "sim-res-dir",
        "--"
      );

      return;
    }

    payload[name] = value;
  }


  const result =
    getElement("sim-result");

  if (result) {
    result.classList.remove("hidden");
  }


  try {

    const data =
      await api("/api/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

    console.log(
      "[SIMULATION]",
      data
    );


    if (
      !data ||
      data.status !== "ok"
    ) {

      throw new Error(
        data?.reason ||
        data?.message ||
        "Scenario prediction failed"
      );
    }


    const upScore =
      safeNumber(data.up_score);

    if (upScore !== null) {

      setText(
        "sim-res-price",
        `UP ${(upScore * 100).toFixed(1)}% (uncalibrated)`
      );

    } else {

      setText(
        "sim-res-price",
        "Score unavailable"
      );
    }


    setText(
      "sim-res-dir",
      `${data.direction || "UNKNOWN"} · hypothetical candle`
    );

  } catch (error) {

    console.error(
      "[Simulation Error]",
      error
    );

    setText(
      "sim-res-price",
      error.message ||
      "Simulation failed"
    );

    setText(
      "sim-res-dir",
      "--"
    );
  }
}


// ============================================================
// Benchmark Metrics
// ============================================================

async function loadBenchmarkMetrics() {

  const container =
    getElement("benchmark-cards");

  if (!container) {
    return;
  }

  try {

    const data =
      await api("/api/metrics");

    console.log(
      "[METRICS]",
      data
    );

    container.replaceChildren();


    if (!data.intraday) {

      container.textContent =
        "Train the 15-minute model to see evaluation metrics.";

      return;
    }


    const metadata =
      data.intraday;


    setText(
      "benchmark-note",
      `${metadata.rows || 0} usable rows · ${metadata.test_rows || 0} holdout rows · trained ${utc(metadata.trained_at)}. Selected by chronological CV.`
    );


    const modelResults =
      metadata.model_results || {};


    for (
      const [name, result]
      of Object.entries(modelResults)
    ) {

      const card =
        document.createElement("div");

      card.className =
        `model-benchmark-card ${
          name === metadata.selected_model
            ? "highlight"
            : ""
        }`;


      const title =
        document.createElement("h4");

      title.textContent =
        name +
        (
          name === metadata.selected_model
            ? " · Selected"
            : ""
        );

      card.appendChild(title);


      const test =
        result?.test || {};


      const metrics = [
        [
          "CV balanced accuracy",
          result?.cv_balanced_accuracy
        ],
        [
          "Holdout accuracy",
          test.accuracy
        ],
        [
          "Holdout balanced accuracy",
          test.balanced_accuracy
        ],
        [
          "Precision",
          test.precision
        ],
        [
          "Recall",
          test.recall
        ],
        [
          "F1",
          test.f1
        ]
      ];


      for (
        const [label, value]
        of metrics
      ) {

        const row =
          document.createElement("p");

        row.className =
          "benchmark-row";

        const number =
          safeNumber(value);

        row.textContent =
          number === null
            ? `${label}: --`
            : `${label}: ${(number * 100).toFixed(1)}%`;

        card.appendChild(row);
      }


      container.appendChild(card);
    }

  } catch (error) {

    console.error(
      "[Metrics Error]",
      error
    );

    container.textContent =
      error.message ||
      "Unable to load benchmark metrics.";
  }
}


// ============================================================
// Live Data Fetch
// ============================================================

async function handleTwelveDataFetch() {

  const status =
    getElement("modal-status-msg");

  if (!status) {
    return;
  }

  status.className =
    "modal-status";

  status.textContent =
    "Fetching 15-minute gold candles...";


  try {

    const data =
      await api("/api/fetch-live", {
        method: "POST"
      });


    status.className =
      "modal-status success";

    status.textContent =
      data.message ||
      "Live data fetched successfully.";


    await refreshDashboard();

  } catch (error) {

    console.error(
      "[Live Fetch Error]",
      error
    );

    status.className =
      "modal-status error";

    status.textContent =
      error.message ||
      "Failed to fetch live data.";
  }
}


// ============================================================
// Model Training
// ============================================================

async function trainModel() {

  const button =
    getElement("btn-train-model");

  if (!button) {
    return;
  }

  button.disabled = true;


  try {

    const job =
      await api("/api/models/train", {
        method: "POST"
      });


    setText(
      "training-status",
      job.message ||
      "Model training started."
    );


    if (trainingTimer) {
      clearInterval(trainingTimer);
    }


    trainingTimer =
      setInterval(
        async () => {

          try {

            const status =
              await api(
                "/api/models/training"
              );


            setText(
              "training-status",
              status.message ||
              "Training in progress..."
            );


            if (
              status.status !== "running"
            ) {

              clearInterval(
                trainingTimer
              );

              trainingTimer = null;

              button.disabled = false;


              await Promise.all([
                loadBenchmarkMetrics(),
                fetchLatestPrediction()
              ]);
            }

          } catch (error) {

            clearInterval(
              trainingTimer
            );

            trainingTimer = null;

            button.disabled = false;

            setText(
              "training-status",
              error.message
            );
          }

        },
        3000
      );

  } catch (error) {

    button.disabled = false;

    setText(
      "training-status",
      error.message ||
      "Model training failed."
    );
  }
}


// ============================================================
// News
// ============================================================

async function loadNews() {

  const container =
    getElement("news-items");

  if (!container) {
    return;
  }


  try {

    const data =
      await api("/api/news");


    container.replaceChildren();


    const providers =
      Array.isArray(data.providers)
        ? data.providers
        : [];


    setText(
      "news-status",
      providers
        .map(
          provider =>
            `${provider.name}: ${provider.status}`
        )
        .join(" · ") +
      (
        data.fetched_at
          ? ` · Checked ${utc(data.fetched_at)}`
          : ""
      )
    );


    const items =
      Array.isArray(data.items)
        ? data.items
        : [];


    for (
      const item
      of items
    ) {

      if (!item?.url) {
        continue;
      }


      try {

        const url =
          new URL(item.url);


        if (
          !["http:", "https:"]
            .includes(url.protocol)
        ) {
          continue;
        }


        const article =
          document.createElement("article");

        article.className =
          "news-item";


        const link =
          document.createElement("a");

        link.href =
          url.href;

        link.target =
          "_blank";

        link.rel =
          "noopener noreferrer";

        link.textContent =
          item.title ||
          "Untitled article";


        const meta =
          document.createElement("p");

        meta.textContent =
          `${item.source || "Unknown source"} · ${
            item.category || "News"
          } · ${
            item.time_label || ""
          }: ${
            utc(item.time)
          }`;


        article.append(
          link,
          meta
        );

        container.appendChild(
          article
        );

      } catch (urlError) {

        console.warn(
          "[News] Invalid URL:",
          item.url
        );
      }
    }


    if (!items.length) {

      container.textContent =
        "News sources are temporarily unavailable. Price forecasts continue independently.";
    }

  } catch (error) {

    console.error(
      "[News Error]",
      error
    );

    container.textContent =
      `News unavailable: ${
        error.message
      }`;
  }
}


// ============================================================
// Initial Page Setup
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "[Dashboard] API:",
      API_BASE
    );


    const trainButton =
      getElement("btn-train-model");

    if (trainButton) {
      trainButton.addEventListener(
        "click",
        trainModel
      );
    }


    loadNews();


    setInterval(
      () => {
        if (!document.hidden) {
          refreshDashboard();
        }
      },
      60000
    );


    setInterval(
      () => {
        if (!document.hidden) {
          loadDashboardData();
        }
      },
      15000
    );


    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          refreshDashboard();
        }
      }
    );


    setInterval(
      () => {
        if (!document.hidden) {
          loadNews();
        }
      },
      600000
    );


    setInterval(
      () => {

        if (
          lastChartResponse &&
          Date.now() -
            lastChartResponse >
            45000
        ) {

          setText(
            "status-text",
            "Chart delayed / reconnecting"
          );
        }


        if (
          latestForecast?.forecast_end &&
          Date.now() >=
            Date.parse(
              latestForecast.forecast_end
            )
        ) {

          showUnavailable(
            "Forecast window ended. Waiting for the next completed candle."
          );

          refreshDashboard();
        }

      },
      1000
    );
  }
);