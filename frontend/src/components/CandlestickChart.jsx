"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";

/** Safely convert a "YYYY-MM-DD HH:mm:ss"-style string into a Unix seconds timestamp */
function parseCandleTime(dtStr) {
  if (!dtStr) return 0;
  const clean = String(dtStr).trim();
  const iso = clean.includes("T") ? clean : clean.replace(" ", "T") + "Z";
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) {
    const fallback = new Date(clean).getTime();
    return isNaN(fallback) ? 0 : Math.floor(fallback / 1000);
  }
  return Math.floor(ms / 1000);
}

/**
 * Renders the candlestick / line price chart with SMA, EMA and Bollinger Band
 * overlays using the `lightweight-charts` financial charting engine.
 */
export default function CandlestickChart({
  candles,
  chartStyle,
  showSma,
  showEma,
  showBb,
  onLegendUpdate,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  const lastSortedRef = useRef([]);

  // Create chart once on mount
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 800,
      height: 440,
      layout: {
        background: { type: "solid", color: "#10141e" },
        textColor: "#94a3b8",
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(212, 175, 55, 0.4)", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "rgba(212, 175, 55, 0.4)", width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00c087",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#00c087",
      wickDownColor: "#ef4444",
    });

    const lineSeries = chart.addSeries(LineSeries, {
      color: "#d4af37",
      lineWidth: 2,
      visible: false,
    });

    const smaSeries = chart.addSeries(LineSeries, {
      color: "#00b4d8",
      lineWidth: 1.5,
      lineStyle: LineStyle.Dashed,
      title: "SMA 20",
    });

    const emaSeries = chart.addSeries(LineSeries, {
      color: "#9d4edd",
      lineWidth: 1.5,
      title: "EMA 50",
    });

    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: "rgba(255, 255, 255, 0.35)",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: "BB Upper",
    });

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: "rgba(255, 255, 255, 0.35)",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: "BB Lower",
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        const sorted = lastSortedRef.current;
        if (sorted.length > 0 && onLegendUpdate) onLegendUpdate(sorted[sorted.length - 1]);
        return;
      }
      const candleBar = param.seriesData.get(candleSeries);
      const lineBar = param.seriesData.get(lineSeries);
      if (candleBar && onLegendUpdate) onLegendUpdate(candleBar);
      else if (lineBar && onLegendUpdate) onLegendUpdate(lineBar);
    });

    chartRef.current = chart;
    seriesRef.current = { candleSeries, lineSeries, smaSeries, emaSeries, bbUpperSeries, bbLowerSeries };

    const handleResize = () => {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 440,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push new candle data whenever it changes
  useEffect(() => {
    const { candleSeries, lineSeries, smaSeries, emaSeries, bbUpperSeries, bbLowerSeries } =
      seriesRef.current;
    if (!candleSeries || !candles || candles.length === 0) return;

    const seenTimes = new Set();
    const sorted = [];
    for (const c of candles) {
      const t = parseCandleTime(c.datetime);
      if (t > 0 && !seenTimes.has(t)) {
        seenTimes.add(t);
        sorted.push({
          ...c,
          _time: t,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
        });
      }
    }
    sorted.sort((a, b) => a._time - b._time);
    lastSortedRef.current = sorted;

    candleSeries.setData(sorted.map((c) => ({ time: c._time, open: c.open, high: c.high, low: c.low, close: c.close })));
    lineSeries.setData(sorted.map((c) => ({ time: c._time, value: c.close })));
    smaSeries.setData(sorted.filter((c) => c.sma_20 != null).map((c) => ({ time: c._time, value: Number(c.sma_20) })));
    emaSeries.setData(sorted.filter((c) => c.ema_50 != null).map((c) => ({ time: c._time, value: Number(c.ema_50) })));
    bbUpperSeries.setData(sorted.filter((c) => c.bb_upper != null).map((c) => ({ time: c._time, value: Number(c.bb_upper) })));
    bbLowerSeries.setData(sorted.filter((c) => c.bb_lower != null).map((c) => ({ time: c._time, value: Number(c.bb_lower) })));

    chartRef.current?.timeScale().fitContent();

    if (sorted.length > 0 && onLegendUpdate) {
      onLegendUpdate(sorted[sorted.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  // Candlestick vs line style toggle
  useEffect(() => {
    const { candleSeries, lineSeries } = seriesRef.current;
    if (!candleSeries || !lineSeries) return;
    candleSeries.applyOptions({ visible: chartStyle === "candlestick" });
    lineSeries.applyOptions({ visible: chartStyle === "line" });
  }, [chartStyle]);

  // Overlay visibility toggles
  useEffect(() => {
    seriesRef.current.smaSeries?.applyOptions({ visible: showSma });
  }, [showSma]);
  useEffect(() => {
    seriesRef.current.emaSeries?.applyOptions({ visible: showEma });
  }, [showEma]);
  useEffect(() => {
    seriesRef.current.bbUpperSeries?.applyOptions({ visible: showBb });
    seriesRef.current.bbLowerSeries?.applyOptions({ visible: showBb });
  }, [showBb]);

  return <div ref={containerRef} className="candlestick-chart-container" />;
}
