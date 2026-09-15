"use client";

import { useEffect, useRef } from "react";

/** Loads the TradingView widget script once and (re)mounts the widget for the given symbol. */
export default function TradingViewWidget({ symbol }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    function renderIframeFallback() {
      container.innerHTML = `
        <iframe
          src="https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=60&theme=dark&style=1&timezone=Etc%2FUTC&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=10141e"
          style="width: 100%; height: 100%; border: none;"
          allowtransparency="true"
          scrolling="no"
          allowfullscreen>
        </iframe>`;
    }

    function buildWidget() {
      if (typeof window.TradingView !== "undefined" && window.TradingView.widget) {
        try {
          // eslint-disable-next-line no-new
          new window.TradingView.widget({
            autosize: true,
            symbol,
            interval: "60",
            timezone: "Etc/UTC",
            theme: "dark",
            style: "1",
            locale: "en",
            toolbar_bg: "#10141e",
            enable_publishing: false,
            allow_symbol_change: true,
            container_id: "tradingview_widget_container",
            hide_side_toolbar: false,
            withdateranges: true,
            save_image: true,
            studies: ["STD;SMA", "STD;EMA", "STD;Bollinger_Bands"],
          });
          return;
        } catch (err) {
          console.warn("TradingView.widget initialization error, falling back to iframe embed:", err);
        }
      }
      renderIframeFallback();
    }

    if (typeof window.TradingView === "undefined") {
      const existing = document.getElementById("tradingview-widget-script");
      if (existing) {
        existing.addEventListener("load", buildWidget, { once: true });
      } else {
        const script = document.createElement("script");
        script.id = "tradingview-widget-script";
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = buildWidget;
        script.onerror = renderIframeFallback;
        document.body.appendChild(script);
      }
    } else {
      buildWidget();
    }
  }, [symbol]);

  return <div id="tradingview_widget_container" ref={containerRef} className="tradingview-container" />;
}
