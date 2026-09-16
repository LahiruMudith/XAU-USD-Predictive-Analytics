"use client";

import { useState } from "react";

export default function ApiKeyModal({ open, onClose, onSubmit }) {
  const [apiKey, setApiKey] = useState("");
  const [interval, setInterval_] = useState("1h");
  const [outputsize, setOutputsize] = useState(500);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text }
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleSave() {
    if (!apiKey.trim()) {
      setStatus({ type: "error", text: "Please enter your Twelve Data API Key." });
      return;
    }
    setBusy(true);
    setStatus({ type: "info", text: "Connecting to Twelve Data API & fetching market candles..." });
    try {
      const message = await onSubmit({ api_key: apiKey.trim(), interval, outputsize: Number(outputsize) });
      setStatus({ type: "success", text: message });
      setTimeout(() => {
        onClose();
        setStatus(null);
      }, 1500);
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Twelve Data API Configuration</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">
            Connect your account from{" "}
            <a href="https://twelvedata.com/login" target="_blank" rel="noopener noreferrer">
              twelvedata.com
            </a>{" "}
            to stream real-time XAU/USD gold quotes.
          </p>
          <div className="input-group">
            <label htmlFor="modal-api-key">Twelve Data API Key</label>
            <input
              id="modal-api-key"
              type="password"
              placeholder="Enter Twelve Data API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label htmlFor="modal-interval">Candle Interval</label>
            <select id="modal-interval" value={interval} onChange={(e) => setInterval_(e.target.value)}>
              <option value="1h">1 Hour (1h)</option>
              <option value="1day">1 Day (1d)</option>
              <option value="15min">15 Minutes (15m)</option>
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="modal-outputsize">Candles to Pull</label>
            <input
              id="modal-outputsize"
              type="number"
              min={50}
              max={2000}
              value={outputsize}
              onChange={(e) => setOutputsize(e.target.value)}
            />
          </div>
          {status && <div className={`modal-status ${status.type}`}>{status.text}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
            Save &amp; Ingest Live Data
          </button>
        </div>
      </div>
    </div>
  );
}
