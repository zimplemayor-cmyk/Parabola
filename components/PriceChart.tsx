"use client";

import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { CurveChart } from "./CurveChart";
import { CandleChart } from "./CandleChart";
import { fetchTrades, tradesToCandles, autoTimeframe, TIMEFRAMES, type Trade, type TimeframeLabel, type Candle } from "@/lib/trades";

type ChartMode = "line" | "candles";
type DisplayMode = "price" | "marketCap";

// Shared across every chart on the site (token pages, anywhere else this
// mounts), stored client-side only: a chart-type or timeframe pick on one
// token carries over to the next, matching how a real trading app behaves.
const MODE_KEY = "parabola-chart-mode";
const DISPLAY_KEY = "parabola-chart-display";

function readPref<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return (window.localStorage.getItem(key) as T | null) ?? fallback;
}

export function PriceChart({
  curveAddress,
  fromBlock,
  progress,
  totalSupply,
}: {
  curveAddress: `0x${string}` | undefined;
  fromBlock: bigint | undefined;
  progress: number;
  /** 18-decimal total supply; when provided, unlocks the price/market-cap toggle. */
  totalSupply?: bigint;
}) {
  const publicClient = usePublicClient();
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [mode, setMode] = useState<ChartMode>("candles");
  const [display, setDisplay] = useState<DisplayMode>("price");
  const [timeframe, setTimeframe] = useState<TimeframeLabel | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage read, only possible client-side
    setMode(readPref(MODE_KEY, "candles"));
    setDisplay(readPref(DISPLAY_KEY, "price"));
  }, []);

  function setModePersisted(m: ChartMode) {
    setMode(m);
    window.localStorage.setItem(MODE_KEY, m);
  }
  function setDisplayPersisted(d: DisplayMode) {
    setDisplay(d);
    window.localStorage.setItem(DISPLAY_KEY, d);
  }

  useEffect(() => {
    let cancelled = false;
    // fromBlock arrives slightly after curveAddress (it's a separate log
    // lookup), so wait for both rather than firing an unbounded fetch that
    // would hit the exact "earliest" problem this was built to avoid.
    if (!curveAddress || !publicClient || fromBlock === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state when curveAddress changes, before the new async fetch below
    setTrades(null);
    setFetchFailed(false);
    fetchTrades(publicClient, curveAddress, fromBlock)
      .then((t) => {
        if (cancelled) return;
        setTrades(t);
        setTimeframe((prev) => prev ?? autoTimeframe(t));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Trade history fetch failed:", err);
        setTrades([]);
        setFetchFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [curveAddress, fromBlock, publicClient]);

  const candles = useMemo(
    () => (trades && trades.length > 0 && timeframe ? tradesToCandles(trades, timeframe) : []),
    [trades, timeframe]
  );

  const wholeSupply = totalSupply !== undefined ? Number(totalSupply) / 1e18 : undefined;
  const scaledCandles: Candle[] = useMemo(() => {
    if (display !== "marketCap" || !wholeSupply) return candles;
    return candles.map((c) => ({
      time: c.time,
      open: c.open * wholeSupply,
      high: c.high * wholeSupply,
      low: c.low * wholeSupply,
      close: c.close * wholeSupply,
    }));
  }, [candles, display, wholeSupply]);

  // No real trades yet (new/quiet token, or the fetch itself failed): fall
  // back to the theoretical bonding-curve shape rather than an empty or
  // fake-looking chart, but say which case it actually is.
  const hasHistory = trades !== null && trades.length >= 2;

  if (!hasHistory) {
    return (
      <div>
        <CurveChart progress={progress} />
        <p className="mt-3 text-center text-xs text-paper-faint">
          {trades === null
            ? "Loading trade history…"
            : fetchFailed
              ? "Couldn't load trade history from the network just now. Showing the bonding curve's shape instead."
              : "Showing the bonding curve's shape, real price history will appear here once trading starts."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-ink-border p-0.5">
            {(["candles", "line"] as ChartMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setModePersisted(m)}
                className={`rounded-full px-3 py-1 text-xs font-mono capitalize transition ${
                  mode === m ? "bg-ink-surface text-paper" : "text-paper-faint hover:text-paper-dim"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {wholeSupply && (
            <div className="flex rounded-full border border-ink-border p-0.5">
              {([
                ["price", "Price"],
                ["marketCap", "Market cap"],
              ] as [DisplayMode, string][]).map(([d, label]) => (
                <button
                  key={d}
                  onClick={() => setDisplayPersisted(d)}
                  className={`rounded-full px-3 py-1 text-xs font-mono transition ${
                    display === d ? "bg-ink-surface text-paper" : "text-paper-faint hover:text-paper-dim"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
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
        <CandleChart candles={scaledCandles} />
      ) : (
        <LineFromCandles candles={scaledCandles} />
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
