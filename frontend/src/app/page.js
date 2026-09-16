"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import IndicatorChart from "@/components/IndicatorChart";
import PredictionCard from "@/components/PredictionCard";
import SimulatorCard from "@/components/SimulatorCard";
import BenchmarkSection from "@/components/BenchmarkSection";
import ApiKeyModal from "@/components/ApiKeyModal";
import TvConfigModal from "@/components/TvConfigModal";
import Footer from "@/components/Footer";
import {
  getHealth,
  getHistorical,
  getMetrics,
  predictLatest,
  predictCustom,
  fetchLiveData,
} from "@/lib/api";

// lightweight-charts and TradingView's widget both need `window`, so load client-side only.
const CandlestickChart = dynamic(() => import("@/components/CandlestickChart"), { ssr: false });
const TradingViewWidget = dynamic(() => import("@/components/TradingViewWidget"), { ssr: false });

const DEFAULT_TV_URL = "https://www.tradingview.com/chart/S73cSsF5/?symbol=OANDA%3AXAUUSD";
const DEFAULT_TV_SYMBOL = "OANDA:XAUUSD";

const MODEL_LABELS = {
  best: "Best Model (Random Forest)",
  rf: "Random Forest Regressor",
  svr: "Support Vector Regressor (SVR)",
};

export default function DashboardPage() {
  // Backend connectivity
  const [backendConnected, setBackendConnected] = useState(false);

  // Chart data & controls
  const [candles, setCandles] = useState([]);
  const [limit, setLimit] = useState(100);
  const [chartView, setChartView] = useState("ml"); // 'ml' | 'tv'
  const [chartStyle, setChartStyle] = useState("candlestick"); // 'candlestick' | 'line'
  const [showSma, setShowSma] = useState(true);
  const [showEma, setShowEma] = useState(true);
  const [showBb, setShowBb] = useState(true);
  const [activeIndicator, setActiveIndicator] = useState("rsi"); // 'rsi' | 'macd'
  const [legend, setLegend] = useState(null);

  // TradingView config (persisted)
  const [tvUrl, setTvUrl] = useState(DEFAULT_TV_URL);
  const [tvSymbol, setTvSymbol] = useState(DEFAULT_TV_SYMBOL);

  // Prediction
  const [model, setModel] = useState("best");
  const [prediction, setPrediction] = useState(null);

  // Simulator
  const [simResult, setSimResult] = useState(null);

  // Benchmark metrics
  const [metrics, setMetrics] = useState(null);

  // Modals
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [tvModalOpen, setTvModalOpen] = useState(false);

  // Restore TradingView config from localStorage on mount
  useEffect(() => {
    const storedUrl = window.localStorage.getItem("tv_chart_url");
    const storedSymbol = window.localStorage.getItem("tv_chart_symbol");
    if (storedUrl) setTvUrl(storedUrl);
    if (storedSymbol) setTvSymbol(storedSymbol);
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      const data = await getHistorical(limit);
      setCandles(data.candles || []);
    } catch (err) {
      console.error("Dashboard data load error:", err);
    }
  }, [limit]);

  const loadPrediction = useCallback(async (modelChoice) => {
    try {
      const data = await predictLatest(modelChoice);
      setPrediction(data);
    } catch (err) {
      console.error("Inference fetch error:", err);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await getMetrics();
      setMetrics(data);
    } catch (err) {
      console.warn("Metrics load error:", err);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const data = await getHealth();
      setBackendConnected(Boolean(data.status === "ok"));
    } catch {
      setBackendConnected(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    checkHealth();
    loadDashboardData();
    loadMetrics();
    loadPrediction(model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload candles whenever the requested candle count changes
  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  function handleRefresh() {
    checkHealth();
    loadDashboardData();
    loadPrediction(model);
  }

  function handleModelChange(newModel) {
    setModel(newModel);
    loadPrediction(newModel);
  }

  async function handleSimulate(payload) {
    const result = await predictCustom({ ...payload, model_choice: model });
    setSimResult(result);
  }

  async function handleTwelveDataFetch(payload) {
    const data = await fetchLiveData();
    loadDashboardData();
    loadPrediction(model);
    return data.message || "Live data ingested successfully.";
  }

  function handleSaveTvConfig(newUrl, newSymbol) {
    setTvUrl(newUrl);
    setTvSymbol(newSymbol);
    window.localStorage.setItem("tv_chart_url", newUrl);
    window.localStorage.setItem("tv_chart_symbol", newSymbol);
  }

  // Ticker derived values
  const latest = candles.length > 0 ? candles[candles.length - 1] : null;
  const last24 = candles.slice(-24);
  const high24 = last24.length > 0 ? Math.max(...last24.map((c) => c.high)) : 0;
  const low24 = last24.length > 0 ? Math.min(...last24.map((c) => c.low)) : 0;

  // Legend bar derived values
  const legendOpen = legend ? (typeof legend.open === "number" ? legend.open : legend.value ?? 0) : 0;
  const legendHigh = legend ? (typeof legend.high === "number" ? legend.high : legendOpen) : 0;
  const legendLow = legend ? (typeof legend.low === "number" ? legend.low : legendOpen) : 0;
  const legendClose = legend ? (typeof legend.close === "number" ? legend.close : legend.value ?? legendOpen) : 0;
  const legendDiff = legendClose - legendOpen;
  const legendPct = legendOpen !== 0 ? (legendDiff / legendOpen) * 100 : 0;
  const legendIsUp = legendDiff >= 0;

  return (
    <>
      <Header
        backendConnected={backendConnected}
        tvUrl={tvUrl}
        onOpenApiModal={() => setApiModalOpen(true)}
        onRefresh={handleRefresh}
      />

      <TickerBar
        currentPrice={latest ? latest.close : 0}
        high24={high24}
        low24={low24}
        activeModelLabel={MODEL_LABELS[model]}
      />

      <main className="dashboard-container">
        <section className="chart-section">
          <div className="card chart-card">
            <div className="card-header chart-header-row">
              <div className="card-title-group">
                <div className="chart-tab-group">
                  <button
                    className={`chart-tab-btn ${chartView === "ml" ? "active" : ""}`}
                    onClick={() => setChartView("ml")}
                  >
                    <span className="tv-icon">🕯️</span> Candlestick Terminal
                  </button>
                  <button
                    className={`chart-tab-btn ${chartView === "tv" ? "active" : ""}`}
                    onClick={() => setChartView("tv")}
                  >
                    <span className="tv-icon">📈</span> TradingView Web (OANDA)
                  </button>
                </div>
                <span className="badge badge-gold">OANDA:XAUUSD · 1H</span>
              </div>

              {chartView === "ml" ? (
                <div className="chart-controls">
                  <div className="style-toggle-group">
                    <button
                      type="button"
                      className={`style-toggle-btn ${chartStyle === "candlestick" ? "active" : ""}`}
                      onClick={() => setChartStyle("candlestick")}
                      title="Candlestick Chart"
                    >
                      🕯️ Candles
                    </button>
                    <button
                      type="button"
                      className={`style-toggle-btn ${chartStyle === "line" ? "active" : ""}`}
                      onClick={() => setChartStyle("line")}
                      title="Line Chart"
                    >
                      📈 Line
                    </button>
                  </div>
                  <label>
                    <input type="checkbox" checked={showSma} onChange={(e) => setShowSma(e.target.checked)} /> SMA
                    (20)
                  </label>
                  <label>
                    <input type="checkbox" checked={showEma} onChange={(e) => setShowEma(e.target.checked)} /> EMA
                    (50)
                  </label>
                  <label>
                    <input type="checkbox" checked={showBb} onChange={(e) => setShowBb(e.target.checked)} />{" "}
                    Bollinger Bands
                  </label>
                  <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                    <option value={50}>50 Candles</option>
                    <option value={100}>100 Candles</option>
                    <option value={150}>150 Candles</option>
                  </select>
                </div>
              ) : (
                <div className="tv-controls">
                  <button className="btn btn-xs btn-outline" onClick={() => setTvModalOpen(true)} title="Configure TradingView Chart URL">
                    ⚙ TV Config
                  </button>
                  <a href={tvUrl} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-tv" title="Open chart layout on TradingView">
                    ↗ Open in TradingView
                  </a>
                </div>
              )}
            </div>

            {chartView === "ml" && (
              <div className="candle-legend-bar font-mono">
                <span className="legend-badge">XAU/USD 1H</span>
                <span className="legend-item">
                  O: <strong>${legendOpen.toFixed(2)}</strong>
                </span>
                <span className="legend-item">
                  H: <strong>${legendHigh.toFixed(2)}</strong>
                </span>
                <span className="legend-item">
                  L: <strong>${legendLow.toFixed(2)}</strong>
                </span>
                <span className="legend-item">
                  C: <strong>${legendClose.toFixed(2)}</strong>
                </span>
                <span className="legend-item">
                  Change:{" "}
                  <strong className={legendIsUp ? "bullish-text" : "bearish-text"}>
                    {legendIsUp ? "+" : ""}${legendDiff.toFixed(2)} ({legendIsUp ? "+" : ""}
                    {legendPct.toFixed(2)}%)
                  </strong>
                </span>
              </div>
            )}

            <div className={`chart-wrapper ml-wrapper ${chartView !== "ml" ? "hidden" : ""}`}>
              <CandlestickChart
                candles={candles}
                chartStyle={chartStyle}
                showSma={showSma}
                showEma={showEma}
                showBb={showBb}
                onLegendUpdate={setLegend}
              />
            </div>

            <div className={`chart-wrapper tv-wrapper ${chartView !== "tv" ? "hidden" : ""}`}>
              {chartView === "tv" && <TradingViewWidget symbol={tvSymbol} />}
            </div>
          </div>

          <div className="card sub-chart-card">
            <div className="card-header">
              <div className="tab-group">
                <button
                  className={`tab-btn ${activeIndicator === "rsi" ? "active" : ""}`}
                  onClick={() => setActiveIndicator("rsi")}
                >
                  RSI Indicator (14)
                </button>
                <button
                  className={`tab-btn ${activeIndicator === "macd" ? "active" : ""}`}
                  onClick={() => setActiveIndicator("macd")}
                >
                  MACD (12, 26, 9)
                </button>
              </div>
              <span className="current-indicator-val font-mono">
                {activeIndicator === "rsi"
                  ? `RSI: ${latest ? latest.rsi_14.toFixed(2) : "--"}`
                  : `MACD: ${latest ? latest.macd.toFixed(3) : "--"}`}
              </span>
            </div>
            <div className="chart-wrapper sub-wrapper">
              <IndicatorChart candles={candles} activeIndicator={activeIndicator} />
            </div>
          </div>
        </section>

        <section className="prediction-section">
          <PredictionCard
            model={model}
            onModelChange={handleModelChange}
            prediction={prediction}
            onPredictNow={() => loadPrediction(model)}
          />
          <SimulatorCard defaults={latest} onSubmit={handleSimulate} result={simResult} />
        </section>
      </main>

      <BenchmarkSection metrics={metrics} />

      <ApiKeyModal
        open={apiModalOpen}
        onClose={() => setApiModalOpen(false)}
        onSubmit={handleTwelveDataFetch}
      />

      <TvConfigModal
        open={tvModalOpen}
        onClose={() => setTvModalOpen(false)}
        tvUrl={tvUrl}
        tvSymbol={tvSymbol}
        defaultSymbol={DEFAULT_TV_SYMBOL}
        onSave={handleSaveTvConfig}
      />

      <Footer />
    </>
  );
}
