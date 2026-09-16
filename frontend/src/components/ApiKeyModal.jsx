"use client";

import { useState } from "react";

export default function ApiKeyModal({ open, onClose, onSubmit }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleFetch() {
    setBusy(true);
    setStatus({ type: "info", text: "Connecting to Twelve Data through the FastAPI backend..." });
    try {
      const message = await onSubmit();
      setStatus({ type: "success", text: message });
      setTimeout(() => {
        onClose();
        setStatus(null);
      }, 1200);
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
          <h3>Twelve Data Connection</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            Twelve Data is configured on the FastAPI backend. Keep the API key
            in the project-root <code>.env</code> file; it is never exposed to the browser.
          </p>
          <div className="input-group">
            <label>Backend configuration</label>
            <div className="modal-status">
              <code>TWELVE_DATA_API_KEY</code> → <code>.env</code> → FastAPI → Twelve Data
            </div>
          </div>
          {status && <div className={`modal-status ${status.type}`}>{status.text}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleFetch} disabled={busy}>
            {busy ? "Connecting..." : "Test & Refresh Live Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
