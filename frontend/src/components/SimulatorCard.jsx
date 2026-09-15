"use client";

import { useState, useEffect } from "react";

export default function SimulatorCard({ defaults, onSubmit, result }) {
  const [form, setForm] = useState({ open: "", high: "", low: "", close: "", volume: 3800 });

  useEffect(() => {
    if (defaults) {
      setForm((prev) => ({
        ...prev,
        open: defaults.open.toFixed(2),
        high: defaults.high.toFixed(2),
        low: defaults.low.toFixed(2),
        close: defaults.close.toFixed(2),
      }));
    }
  }, [defaults]);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      open: parseFloat(form.open),
      high: parseFloat(form.high),
      low: parseFloat(form.low),
      close: parseFloat(form.close),
      volume: parseFloat(form.volume),
    });
  }

  return (
    <div className="card simulator-card">
      <div className="card-header">
        <h3>Scenario Price Simulator</h3>
        <span className="help-text">Simulate custom candle</span>
      </div>
      <form className="simulator-grid" onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="sim-open">Open Price ($)</label>
          <input
            id="sim-open"
            type="number"
            step="0.1"
            required
            value={form.open}
            onChange={(e) => handleChange("open", e.target.value)}
          />
        </div>
        <div className="input-group">
          <label htmlFor="sim-high">High Price ($)</label>
          <input
            id="sim-high"
            type="number"
            step="0.1"
            required
            value={form.high}
            onChange={(e) => handleChange("high", e.target.value)}
          />
        </div>
        <div className="input-group">
          <label htmlFor="sim-low">Low Price ($)</label>
          <input
            id="sim-low"
            type="number"
            step="0.1"
            required
            value={form.low}
            onChange={(e) => handleChange("low", e.target.value)}
          />
        </div>
        <div className="input-group">
          <label htmlFor="sim-close">Close Price ($)</label>
          <input
            id="sim-close"
            type="number"
            step="0.1"
            required
            value={form.close}
            onChange={(e) => handleChange("close", e.target.value)}
          />
        </div>
        <div className="input-group full-width">
          <label htmlFor="sim-volume">Volume</label>
          <input
            id="sim-volume"
            type="number"
            required
            value={form.volume}
            onChange={(e) => handleChange("volume", e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-outline btn-block full-width">
          Simulate ML Reaction
        </button>
      </form>

      {result && (
        <div className="sim-result">
          <div className="sim-line">
            Predicted Next Close:{" "}
            <strong>
              ${result.predicted_price.toFixed(2)} ({result.predicted_change >= 0 ? "+" : ""}
              {result.predicted_change.toFixed(2)})
            </strong>
          </div>
          <div className="sim-line">
            Simulated Direction:{" "}
            <span
              className={`badge ${result.signal === "BULLISH" ? "bullish" : "bearish"}`}
              style={{ color: result.signal === "BULLISH" ? "var(--bullish)" : "var(--bearish)" }}
            >
              {result.signal}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
