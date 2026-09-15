"use client";

import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { CurveChart } from "./CurveChart";
import { CandleChart } from "./CandleChart";
import { fetchTrades, tradesToCandles, autoTimeframe, TIMEFRAMES, type Trade, type TimeframeLabel } from "@/lib/trades";

type ChartMode = "line" | "candles";

export function PriceChart({ curveAddress, progress }: { curveAddress: `0x${string}` | undefined; progress: number }) {
  const publicClient = usePublicClient();
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [mode, setMode] = useState<ChartMode>("candles");
  const [timeframe, setTimeframe] = useState<TimeframeLabel | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!curveAddress || !publicClient) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state when curveAddress changes, before the new async fetch below
    setTrades(null);
    fetchTrades(publicClient, curveAddress)
      .then((t) => {
        if (cancelled) return;
        setTrades(t);
        setTimeframe((prev) => prev ?? autoTimeframe(t));
      })
      .catch(() => {
        if (!cancelled) setTrades([]);
      });
    return () => {
      cancelled = true;
    };
  }, [curveAddress, publicClient]);

  const candles = useMemo(
    () => (trades && trades.length > 0 && timeframe ? tradesToCandles(trades, timeframe) : []),
    [trades, timeframe]
  );

  // No real trades yet (new/quiet token): fall back to the theoretical
  // bonding-curve shape rather than an empty or fake-looking chart.
  const hasHistory = trades !== null && trades.length >= 2;

  if (!hasHistory) {
    return (
      <div>
        <CurveChart progress={progress} />
        <p className="mt-3 text-center text-xs text-paper-faint">
          {trades === null
            ? "Loading trade history…"
            : "Showing the bonding curve's shape, real price history will appear here once trading starts."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-ink-border p-0.5">
          {(["candles", "line"] as ChartMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 text-xs font-mono capitalize transition ${
                mode === m ? "bg-ink-surface text-paper" : "text-paper-faint hover:text-paper-dim"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex rounded-full border border-ink-border p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => setTimeframe(tf.label)}
              className={`rounded-full px-2.5 py-1 text-xs font-mono transition ${
                timeframe === tf.label ? "bg-ink-surface text-paper" : "text-paper-faint hover:text-paper-dim"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>
      {mode === "candles" ? (
        <CandleChart candles={candles} />
      ) : (
        <LineFromCandles candles={candles} />
      )}
    </div>
  );
}

/** Line view over real trade closes (distinct from CurveChart, which draws
 *  the theoretical curve shape rather than executed prices). */
function LineFromCandles({ candles }: { candles: ReturnType<typeof tradesToCandles> }) {
  const width = 640;
  const height = 280;
  const padding = 10;
  const high = Math.max(...candles.map((c) => c.close));
  const low = Math.min(...candles.map((c) => c.close));
  const range = high - low || high || 1;

  const path = candles
    .map((c, i) => {
      const x = padding + (i / Math.max(1, candles.length - 1)) * (width - padding * 2);
      const yVal = height - padding - ((c.close - low) / range) * (height - padding * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${yVal.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Price line chart">
      <path d={path} stroke="#2BB6E0" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
