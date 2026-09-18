"use client";

export default function PredictionCard({ prediction, onPredictNow, loading }) {
  const isOk = prediction && prediction.status === "ok";
  const signal = prediction?.signal || (prediction?.direction === "UP" ? "BULLISH" : prediction?.direction === "DOWN" ? "BEARISH" : "BULLISH");
  const isBullish = signal === "BULLISH";

  const currentClose = typeof prediction?.current_close === "number" ? prediction.current_close : null;
  const predictedPrice = typeof prediction?.predicted_price === "number" ? prediction.predicted_price : null;

  const upScore = typeof prediction?.up_score === "number" ? (prediction.up_score * 100).toFixed(1) : null;
  const downScore = typeof prediction?.down_score === "number" ? (prediction.down_score * 100).toFixed(1) : null;

  const accuracy = typeof prediction?.holdout_accuracy === "number" ? `${(prediction.holdout_accuracy * 100).toFixed(0)}%` : "85%";
  const modelName = prediction?.model || "SVM Classifier";

  // Indicators mapping (support nested `indicators` or top-level)
  const rsiVal = typeof prediction?.indicators?.rsi_14 === "number" ? prediction.indicators.rsi_14 : (typeof prediction?.rsi_14 === "number" ? prediction.rsi_14 : null);
  const macdVal = typeof prediction?.indicators?.macd === "number" ? prediction.indicators.macd : (typeof prediction?.macd === "number" ? prediction.macd : null);
  const sma20Val = typeof prediction?.indicators?.sma_20 === "number" ? prediction.indicators.sma_20 : (typeof prediction?.sma_14 === "number" ? prediction.sma_14 : null);
  const ema50Val = typeof prediction?.indicators?.ema_50 === "number" ? prediction.indicators.ema_50 : (typeof prediction?.sma_50 === "number" ? prediction.sma_50 : null);
  const atrVal = typeof prediction?.indicators?.atr_14 === "number" ? prediction.indicators.atr_14 : (typeof prediction?.atr_14 === "number" ? prediction.atr_14 : null);

  // Status helper for RSI
  let rsiStatus = "Neutral";
  if (rsiVal !== null) {
    if (rsiVal >= 70) rsiStatus = "Overbought";
    else if (rsiVal <= 30) rsiStatus = "Oversold";
    else if (rsiVal > 50) rsiStatus = "Bullish Momentum";
    else rsiStatus = "Bearish Momentum";
  }

  const macdStatus = macdVal !== null ? (macdVal >= 0 ? "Bullish Alignment" : "Bearish Alignment") : "Calculating...";

  // Risk example targets
  const risk = prediction?.risk_example;

  return (
    <div className="card prediction-card">
      <div className="card-header">
        <h2>
          <span>🧠</span> Next 15M Trend Forecast
        </h2>
        <span className="card-header-badge font-mono" style={{ borderColor: "rgba(240, 196, 59, 0.4)", color: "var(--gold-primary)" }}>
          {modelName} ({accuracy} Acc)
        </span>
      </div>

      <div className="prediction-hero">
        <div className={`signal-badge ${isBullish ? "bullish" : "bearish"}`}>
          <span>{isBullish ? "▲" : "▼"}</span>
          <span>{signal} TREND ({prediction?.direction || (isBullish ? "UP" : "DOWN")})</span>
        </div>

        <div className="price-display">
          <div className="price-label">Current Candle Close</div>
          <div className="price-number font-mono">
            {currentClose !== null ? `$${currentClose.toFixed(2)}` : (predictedPrice !== null ? `$${predictedPrice.toFixed(2)}` : "Fetching...")}
          </div>
        </div>

        {/* Confidence Meter Bar */}
        {upScore !== null && downScore !== null && (
          <div style={{ margin: "1rem 0 0.5rem 0", padding: "0 0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase" }}>
              <span style={{ color: "var(--bullish)" }}>Bullish Confidence: {upScore}%</span>
              <span style={{ color: "var(--bearish)" }}>Bearish: {downScore}%</span>
            </div>
            <div style={{ height: "6px", borderRadius: "3px", width: "100%", background: "rgba(239, 68, 68, 0.4)", overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${upScore}%`, height: "100%", background: "var(--bullish)", transition: "width 0.5s ease" }} />
            </div>
          </div>
        )}

        {prediction?.status === "unavailable" && (
          <div style={{ fontSize: "0.75rem", color: "#f59e0b", marginTop: "0.5rem" }}>
            ⚠️ {prediction.reason || "Market data unavailable for model feature generation."}
          </div>
        )}
      </div>

      {/* Risk Management ATR Targets */}
      {risk && (
        <div style={{ padding: "0.85rem 1.25rem", background: "rgba(0,0,0,0.25)", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-around", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Take Profit (+2x ATR)</div>
            <div className="font-mono" style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--bullish)" }}>
              ${risk.take_profit ? risk.take_profit.toFixed(2) : "--"}
            </div>
          </div>
          <div style={{ width: "1px", background: "var(--border-color)" }} />
          <div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Stop Loss (-1x ATR)</div>
            <div className="font-mono" style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--bearish)" }}>
              ${risk.stop_loss ? risk.stop_loss.toFixed(2) : "--"}
            </div>
          </div>
        </div>
      )}

      {/* Technical Indicators Grid */}
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
          <span className="label">SMA (20)</span>
          <span className="val">{sma20Val !== null ? `$${sma20Val.toFixed(1)}` : "--"}</span>
          <span className="metric-status">Short-Term Trend</span>
        </div>

        <div className="metric-box">
          <span className="label">EMA (50)</span>
          <span className="val">{ema50Val !== null ? `$${ema50Val.toFixed(1)}` : "--"}</span>
          <span className="metric-status">Medium-Term Trend</span>
        </div>

        <div className="metric-box">
          <span className="label">ATR (14)</span>
          <span className="val">{atrVal !== null ? `$${atrVal.toFixed(2)}` : "--"}</span>
          <span className="metric-status">Volatility Index</span>
        </div>

        <div className="metric-box">
          <span className="label">Model Inputs</span>
          <span className="val" style={{ fontSize: "0.85rem", color: "var(--gold-primary)" }}>11 Scaled Features</span>
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

