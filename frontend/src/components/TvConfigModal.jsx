"use client";

import { useState, useEffect } from "react";

function extractSymbolFromUrl(url, fallback) {
  try {
    const parsed = new URL(url);
    const sym = parsed.searchParams.get("symbol");
    if (sym) return decodeURIComponent(sym);
  } catch {
    const match = url.match(/[?&]symbol=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return fallback;
}

export default function TvConfigModal({ open, onClose, tvUrl, tvSymbol, defaultSymbol, onSave }) {
  const [url, setUrl] = useState(tvUrl);
  const [symbol, setSymbol] = useState(tvSymbol);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (open) {
      setUrl(tvUrl);
      setSymbol(tvSymbol);
      setStatus(null);
    }
  }, [open, tvUrl, tvSymbol]);

  if (!open) return null;

  function handleUrlChange(value) {
    setUrl(value);
    const extracted = extractSymbolFromUrl(value.trim(), null);
    if (extracted) setSymbol(extracted);
  }

  function handleSave() {
    const newUrl = url.trim() || tvUrl;
    const newSymbol = symbol.trim() || extractSymbolFromUrl(newUrl, defaultSymbol);
    onSave(newUrl, newSymbol);
    setStatus({ text: `Connected to ${newSymbol}!` });
    setTimeout(onClose, 1000);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>TradingView Chart Connection</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">
            Connected TradingView chart workspace. You can update the chart layout URL or market symbol below.
          </p>
          <div className="input-group">
            <label htmlFor="modal-tv-url">TradingView Chart URL</label>
            <input id="modal-tv-url" type="url" value={url} onChange={(e) => handleUrlChange(e.target.value)} />
          </div>
          <div className="input-group">
            <label htmlFor="modal-tv-symbol">Chart Symbol</label>
            <input
              id="modal-tv-symbol"
              type="text"
              placeholder="e.g. OANDA:XAUUSD"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </div>
          {status && <div className="modal-status success">{status.text}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Apply &amp; Reload Chart
          </button>
        </div>
      </div>
    </div>
  );
}
