"use client";

export default function PredictionCard({ prediction, onPredictNow, loading }) {
  const signal = prediction?.signal || "BULLISH";
  const isBullish = signal === "BULLISH";
  const changeColor = (prediction?.predicted_change ?? 0) >= 0 ? "var(--bullish)" : "var(--bearish)";
  const sign = (prediction?.predicted_change ?? 0) >= 0 ? "+" : "";

  // Helper status for RSI
  const rsiVal = prediction?.rsi_14 ?? 50;
  let rsiStatus = "Neutral";
  if (rsiVal >= 70) rsiStatus = "Overbought";
  else if (rsiVal <= 30) rsiStatus = "Oversold";
  else if (rsiVal > 50) rsiStatus = "Bullish Momentum";
  else if (rsiVal < 50) rsiStatus = "Bearish Momentum";

  // Helper status for MACD
  const macdVal = prediction?.macd ?? 0;
  const macdStatus = macdVal >= 0 ? "Bullish Alignment" : "Bearish Alignment";

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
            ${prediction ? prediction.predicted_price.toFixed(2) : "0.00"}
          </div>
        </div>

        <div className="change-display font-mono" style={{ color: changeColor }}>
          {prediction
            ? `${sign}$${prediction.predicted_change.toFixed(2)} (${sign}${prediction.predicted_pct_change.toFixed(2)}%)`
            : "+0.00 (+0.00%)"}
        </div>
      </div>

      <div className="feature-metrics-grid">
        <div className="metric-box">
          <span className="label">RSI (14)</span>
          <span className="val">{prediction ? prediction.rsi_14.toFixed(1) : "--"}</span>
          <span className="metric-status">{prediction ? rsiStatus : "Calculating..."}</span>
        </div>

        <div className="metric-box">
          <span className="label">MACD</span>
          <span className="val">{prediction ? prediction.macd.toFixed(2) : "--"}</span>
          <span className="metric-status">{prediction ? macdStatus : "Calculating..."}</span>
        </div>

        <div className="metric-box">
          <span className="label">SMA (14)</span>
          <span className="val">{prediction?.sma_14 ? `$${prediction.sma_14.toFixed(1)}` : (prediction?.sma_20 ? `$${prediction.sma_20.toFixed(1)}` : "--")}</span>
          <span className="metric-status">Short-Term Trend</span>
        </div>

        <div className="metric-box">
          <span className="label">SMA (50)</span>
          <span className="val">{prediction?.sma_50 ? `$${prediction.sma_50.toFixed(1)}` : (prediction?.ema_50 ? `$${prediction.ema_50.toFixed(1)}` : "--")}</span>
          <span className="metric-status">Medium-Term Trend</span>
        </div>

        <div className="metric-box">
          <span className="label">ATR (14)</span>
          <span className="val">{prediction?.atr_14 ? `$${prediction.atr_14.toFixed(2)}` : "--"}</span>
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
