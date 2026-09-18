"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

import Header from "@/components/Header";
import PredictionCard from "@/components/PredictionCard";
import Footer from "@/components/Footer";
import {
  getHealth,
  getHistorical,
  predictLatest,
} from "@/lib/api";

const TradingViewWidget = dynamic(() => import("@/components/TradingViewWidget"), { ssr: false });

const DEFAULT_TV_SYMBOL = "OANDA:XAUUSD";

export default function DashboardPage() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [candles, setCandles] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tvSymbol, setTvSymbol] = useState(DEFAULT_TV_SYMBOL);

  useEffect(() => {
    const storedSymbol = window.localStorage.getItem("tv_chart_symbol");
    if (storedSymbol) setTvSymbol(storedSymbol);
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      const data = await getHistorical(100);
      setCandles(data.candles || []);
    } catch (err) {
      console.error("Dashboard data load error:", err);
    }
  }, []);

  const loadPrediction = useCallback(async () => {
    setLoading(true);
    try {
      const data = await predictLatest("best");
      setPrediction(data);
    } catch (err) {
      console.error("Inference fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const data = await getHealth();
      setBackendConnected(Boolean(data.status === "ok"));
    } catch {
      setBackendConnected(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    loadDashboardData();
    loadPrediction();
  }, [checkHealth, loadDashboardData, loadPrediction]);

  function handleRefresh() {
    checkHealth();
    loadDashboardData();
    loadPrediction();
  }

  return (
    <>
      <Header backendConnected={backendConnected} onRefresh={handleRefresh} />

      <main className="dashboard-container">
        <section className="chart-section">
          <div className="card chart-card">
            <div className="card-header">
              <h2>
                <span>📈</span> Live TradingView Market Chart
              </h2>
              <span className="card-header-badge font-mono">OANDA:XAUUSD</span>
            </div>

            <div className="chart-wrapper tv-wrapper">
              <TradingViewWidget symbol={tvSymbol} />
            </div>
          </div>
        </section>

        <section className="prediction-section">
          <PredictionCard
            prediction={prediction}
            onPredictNow={loadPrediction}
            loading={loading}
          />
        </section>
      </main>

      <Footer />
    </>
  );
}
