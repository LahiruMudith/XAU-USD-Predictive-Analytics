"use client";

export default function TickerBar({ currentPrice, high24, low24, activeModelLabel }) {
  return (
    <div className="ticker-bar">
      <div className="ticker-item">
        <span className="label">INSTRUMENT</span>
        <span className="val font-mono">XAU/USD (Gold)</span>
      </div>
      <div className="ticker-item">
        <span className="label">CURRENT PRICE</span>
        <span className="val font-mono">${currentPrice.toFixed(2)}</span>
      </div>
      <div className="ticker-item">
        <span className="label">24H HIGH / LOW</span>
        <span className="val font-mono">
          ${high24.toFixed(2)} / ${low24.toFixed(2)}
        </span>
      </div>
      <div className="ticker-item">
        <span className="label">ACTIVE MODEL</span>
        <span className="val highlight">{activeModelLabel}</span>
      </div>
      <div className="ticker-item">
        <span className="label">DATA SOURCE</span>
        <span className="val font-mono">Twelve Data &amp; TradingView (OANDA:XAUUSD)</span>
      </div>
    </div>
  );
}
