"use client";

const MODEL_OPTIONS = [
  { value: "best", label: "Best Model (Random Forest)" },
  { value: "rf", label: "Random Forest Regressor" },
  { value: "svr", label: "Support Vector Regressor (SVR)" },
];

export default function PredictionCard({ model, onModelChange, prediction, onPredictNow }) {
  const signal = prediction?.signal || "BULLISH";
  const isBullish = signal === "BULLISH";
  const changeColor = (prediction?.predicted_change ?? 0) >= 0 ? "var(--bullish)" : "var(--bearish)";
  const sign = (prediction?.predicted_change ?? 0) >= 0 ? "+" : "";

  return (
    <div className="card prediction-card">
      <div className="card-header">
        <h2>Next-Hour ML Forecast</h2>
        <select value={model} onChange={(e) => onModelChange(e.target.value)}>
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="prediction-hero">
        <div className={`signal-badge ${isBullish ? "bullish" : "bearish"}`}>
          {signal} {isBullish ? "▲" : "▼"}
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
        </div>
        <div className="metric-box">
          <span className="label">MACD Line</span>
          <span className="val">{prediction ? prediction.macd.toFixed(2) : "--"}</span>
        </div>
        <div className="metric-box">
          <span className="label">SMA (20)</span>
          <span className="val">{prediction ? `$${prediction.sma_20.toFixed(1)}` : "--"}</span>
        </div>
        <div className="metric-box">
          <span className="label">EMA (50)</span>
          <span className="val">{prediction ? `$${prediction.ema_50.toFixed(1)}` : "--"}</span>
        </div>
      </div>

      <button className="btn btn-primary btn-block" onClick={onPredictNow}>
        ⚡ Run Live Model Inference
      </button>
    </div>
  );
}
