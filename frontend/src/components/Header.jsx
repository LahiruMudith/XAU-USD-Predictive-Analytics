"use client";

export default function Header({ backendConnected, tvUrl, onOpenApiModal, onRefresh }) {
  return (
    <header className="navbar">
      <div className="brand">
        <div className="gold-icon">⚜</div>
        <div>
          <h1>XAU/USD Gold Intelligence</h1>
          <span className="subtext">Machine Learning Market Price Prediction &amp; Analytics</span>
        </div>
      </div>
      <div className="nav-actions">
        <div className="status-badge">
          <span className="status-dot" />
          <span>{backendConnected ? "Backend Connected" : "Backend Offline"}</span>
        </div>
        <a
          href={tvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-tv-nav"
          title="Open chart on TradingView"
        >
          <span className="tv-dot" /> TradingView (OANDA)
        </a>
        <button className="btn btn-outline" onClick={onOpenApiModal}>
          Twelve Data API
        </button>
        <button className="btn btn-primary" onClick={onRefresh}>
          ↻ Refresh Data
        </button>
      </div>
    </header>
  );
}
