"use client";

export default function Header({ backendConnected, onRefresh }) {
  return (
    <header className="navbar">
      <div className="brand">
        <div className="gold-icon-container">
          <span className="gold-icon">⚜</span>
        </div>
        <div>
          <h1>
            XAU/USD Gold Intelligence
          </h1>
          <span className="subtext">
            Machine Learning Market Trend &amp; Price Prediction Terminal
          </span>
        </div>
      </div>

      <div className="nav-actions">
        <div className="model-pill font-mono">
          <span>🧠 SVM Model</span>
        </div>

        <div className="status-badge">
          <span className="status-dot"></span>
          <span>{backendConnected ? "SYSTEM ONLINE" : "CONNECTING..."}</span>
        </div>

        {onRefresh && (
          <button className="btn btn-primary" style={{ padding: "0.4rem 0.85rem", fontSize: "0.8rem" }} onClick={onRefresh}>
            🔄 Refresh
          </button>
        )}
      </div>
    </header>
  );
}
