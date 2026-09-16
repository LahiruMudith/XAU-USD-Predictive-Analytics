"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

/** Secondary chart showing either RSI(14) or MACD(12,26,9), matching the active tab. */
export default function IndicatorChart({ candles, activeIndicator }) {
  const { labels, datasets, yAxis } = useMemo(() => {
    if (!candles || candles.length === 0) {
      return { labels: [], datasets: [], yAxis: {} };
    }

    const labels = candles.map((c) => (c.datetime.split(" ")[1] || c.datetime));

    if (activeIndicator === "rsi") {
      return {
        labels,
        datasets: [
          {
            label: "RSI (14)",
            data: candles.map((c) => c.rsi_14),
            borderColor: "#f59e0b",
            borderWidth: 1.8,
            pointRadius: 0,
            fill: false,
          },
        ],
        yAxis: { min: 10, max: 90, stepSize: 20 },
      };
    }

    return {
      labels,
      datasets: [
        {
          label: "MACD",
          data: candles.map((c) => c.macd),
          borderColor: "#06b6d4",
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
        {
          label: "Signal",
          data: candles.map((c) => c.macd_signal),
          borderColor: "#ec4899",
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
      ],
      yAxis: {},
    };
  }, [candles, activeIndicator]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: {
        min: yAxis.min,
        max: yAxis.max,
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: { color: "#64748b", stepSize: yAxis.stepSize },
      },
    },
  };

  return <Line data={{ labels, datasets }} options={options} />;
}
