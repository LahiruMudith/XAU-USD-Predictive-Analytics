"use client";

export default function PredictionCard({ prediction, onPredictNow, loading }) {
  const hasValidPrediction = prediction && typeof prediction.predicted_price === "number";
  const signal = prediction?.signal || "BULLISH";
  const isBullish = signal === "BULLISH";
  
  const predPrice = hasValidPrediction ? prediction.predicted_price : 0;
  const predChange = hasValidPrediction && typeof prediction.predicted_change === "number" ? prediction.predicted_change : 0;
  const predPctChange = hasValidPrediction && typeof prediction.predicted_pct_change === "number" ? prediction.predicted_pct_change : 0;

  const changeColor = predChange >= 0 ? "var(--bullish)" : "var(--bearish)";
  const sign = predChange >= 0 ? "+" : "";

  // Helper status for RSI
  const rsiVal = typeof prediction?.rsi_14 === "number" ? prediction.rsi_14 : null;
  let rsiStatus = "Neutral";
  if (rsiVal !== null) {
    if (rsiVal >= 70) rsiStatus = "Overbought";
    else if (rsiVal <= 30) rsiStatus = "Oversold";
    else if (rsiVal > 50) rsiStatus = "Bullish Momentum";
    else rsiStatus = "Bearish Momentum";
  }

  // Helper status for MACD
  const macdVal = typeof prediction?.macd === "number" ? prediction.macd : null;
  const macdStatus = macdVal !== null ? (macdVal >= 0 ? "Bullish Alignment" : "Bearish Alignment") : "Calculating...";

  return (
    <div className="card prediction-card">
      <div className="card-header">
        <h2>
          <span>🧠</span> Next 15M Forecast
        </h2>
        <span className="card-header-badge font-mono">SVM Classifier</span>
      </div>

      <div className="prediction-hero">
        <div className={`signal-badge ${isBullish ? "bullish" : "bearish"}`}>
          <span>{isBullish ? "▲" : "▼"}</span>
          <span>{signal} TREND</span>
        </div>

        <div className="price-display">
          <div className="price-label">Predicted Future Close (t+1)</div>
          <div className="price-number font-mono">
            {hasValidPrediction ? `$${predPrice.toFixed(2)}` : "Fetching..."}
          </div>
        </div>

        <div className="change-display font-mono" style={{ color: changeColor }}>
          {hasValidPrediction
            ? `${sign}$${predChange.toFixed(2)} (${sign}${predPctChange.toFixed(2)}%)`
            : "+0.00 (+0.00%)"}
        </div>

        {prediction?.status === "unavailable" && (
          <div style={{ fontSize: "0.75rem", color: "#f59e0b", marginTop: "0.5rem" }}>
            ⚠️ {prediction.reason || "Market data unavailable for model feature generation."}
          </div>
        )}
      </div>

      <div className="feature-metrics-grid">
        <div className="metric-box">
          <span className="label">RSI (14)</span>
          <span className="val">{rsiVal !== null ? rsiVal.toFixed(1) : "--"}</span>
          <span className="metric-status">{rsiVal !== null ? rsiStatus : "Unavailable"}</span>
        </div>

        <div className="metric-box">
          <span className="label">MACD</span>
          <span className="val">{macdVal !== null ? macdVal.toFixed(2) : "--"}</span>
          <span className="metric-status">{macdStatus}</span>
        </div>

        <div className="metric-box">
          <span className="label">SMA (14)</span>
          <span className="val">
            {typeof prediction?.sma_14 === "number" ? `$${prediction.sma_14.toFixed(1)}` : (typeof prediction?.sma_20 === "number" ? `$${prediction.sma_20.toFixed(1)}` : "--")}
          </span>
          <span className="metric-status">Short-Term Trend</span>
        </div>

        <div className="metric-box">
          <span className="label">SMA (50)</span>
          <span className="val">
            {typeof prediction?.sma_50 === "number" ? `$${prediction.sma_50.toFixed(1)}` : (typeof prediction?.ema_50 === "number" ? `$${prediction.ema_50.toFixed(1)}` : "--")}
          </span>
          <span className="metric-status">Medium-Term Trend</span>
        </div>

        <div className="metric-box">
          <span className="label">ATR (14)</span>
          <span className="val">
            {typeof prediction?.atr_14 === "number" ? `$${prediction.atr_14.toFixed(2)}` : "--"}
          </span>
          <span className="metric-status">Volatility Index</span>
        </div>

        <div className="metric-box">
          <span className="label">Model Inputs</span>
          <span className="val" style={{ fontSize: "0.85rem", color: "var(--gold-primary)" }}>11 Features</span>
          <span className="metric-status">SVM Pipeline</span>
        </div>
      </div>

      <div className="prediction-actions">
        <button className="btn btn-primary btn-block" onClick={onPredictNow} disabled={loading}>
          {loading ? "⏳ Running Inference..." : "⚡ Run Live Model Inference"}
        </button>
      </div>
    </div>
  );
}
