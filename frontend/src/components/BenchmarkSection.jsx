"use client";

export default function BenchmarkSection({ metrics }) {
  const results = metrics?.model_results || {};
  const bestModel = metrics?.best_model;
  const entries = Object.entries(results);

  return (
    <section className="benchmark-section">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Model Evaluation &amp; Assignment Benchmark</h2>
            <span className="subtext">5-Fold TimeSeries Cross Validation and Holdout Test Set Performance</span>
          </div>
        </div>
        <div className="benchmark-grid">
          {entries.length === 0 && <div className="loading-state">Loading model metrics...</div>}
          {entries.map(([modelName, info]) => {
            const isBest = modelName === bestModel;
            const m = info.Test_Metrics || {};
            return (
              <div key={modelName} className={`model-benchmark-card ${isBest ? "highlight" : ""}`}>
                <div className="mb-header">
                  <h4>{modelName}</h4>
                  {isBest && (
                    <span
                      className="badge"
                      style={{ backgroundColor: "var(--gold-primary)", color: "#000", fontWeight: 700 }}
                    >
                      ★ Best Model
                    </span>
                  )}
                </div>
                <div className="mb-stats-row">
                  <div className="stat-item">
                    <div className="stat-lbl">TimeSeries CV RMSE</div>
                    <div className="stat-val font-mono">
                      ${info.CV_RMSE_Mean !== undefined ? info.CV_RMSE_Mean.toFixed(2) : "--"}
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-lbl">Test MAE</div>
                    <div className="stat-val font-mono">${m.MAE !== undefined ? m.MAE.toFixed(2) : "--"}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-lbl">Test RMSE</div>
                    <div className="stat-val font-mono">${m.RMSE !== undefined ? m.RMSE.toFixed(2) : "--"}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-lbl">R² Score</div>
                    <div className="stat-val font-mono">
                      {m.R2 !== undefined ? (m.R2 * 100).toFixed(1) + "%" : "--"}
                    </div>
                  </div>
                </div>
                <div className="stat-item" style={{ background: "rgba(212, 175, 55, 0.05)" }}>
                  <div className="stat-lbl">Directional Accuracy</div>
                  <div className="stat-val font-mono" style={{ color: "var(--bullish)" }}>
                    {m.Directional_Accuracy_percent ?? "--"}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
