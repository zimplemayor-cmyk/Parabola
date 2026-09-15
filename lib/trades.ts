import type { PublicClient } from "viem";
import { BondingCurveAbi } from "./contracts";

export interface Trade {
  blockNumber: bigint;
  timestamp: number; // unix seconds
  /** quote-per-whole-token, in real (non-scaled) units */
  price: number;
}

export interface Candle {
  time: number; // bucket start, unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Reads every Buy/Sell event ever emitted by a curve and derives an implied
 * trade price from each (quoteIn/tokensOut for buys, quoteOut/tokensIn for
 * sells), real executed prices, not the theoretical curve shape. This is a
 * client-side read of contract logs; there's no backend indexer behind it,
 * so on a brand-new or quiet token this can come back with very few (or
 * zero) trades. Callers should handle that case explicitly rather than
 * rendering an empty/misleading chart.
 */
export async function fetchTrades(client: PublicClient, curveAddress: `0x${string}`): Promise<Trade[]> {
  const anyClient = client as any;
  const [buyLogs, sellLogs] = await Promise.all([
    anyClient.getLogs({
      address: curveAddress,
      abi: BondingCurveAbi,
      eventName: "Buy",
      fromBlock: "earliest",
      toBlock: "latest",
    }),
    anyClient.getLogs({
      address: curveAddress,
      abi: BondingCurveAbi,
      eventName: "Sell",
      fromBlock: "earliest",
      toBlock: "latest",
    }),
  ]);

  const raw = [
    ...buyLogs.map((l: any) => ({
      blockNumber: l.blockNumber as bigint,
      quote: l.args.quoteIn as bigint,
      tokens: l.args.tokensOut as bigint,
    })),
    ...sellLogs.map((l: any) => ({
      blockNumber: l.blockNumber as bigint,
      quote: l.args.quoteOut as bigint,
      tokens: l.args.tokensIn as bigint,
    })),
  ].filter((t) => t.tokens > 0n);

  if (raw.length === 0) return [];

  // Resolve timestamps for the distinct blocks involved (batched, one call
  // per unique block rather than per trade).
  const uniqueBlocks = Array.from(new Set(raw.map((t) => t.blockNumber)));
  const blocks = await Promise.all(uniqueBlocks.map((bn) => client.getBlock({ blockNumber: bn })));
  const timestampByBlock = new Map(uniqueBlocks.map((bn, i) => [bn, Number(blocks[i].timestamp)]));

  const trades: Trade[] = raw
    .map((t) => ({
      blockNumber: t.blockNumber,
      timestamp: timestampByBlock.get(t.blockNumber) ?? 0,
      // 18-decimal token amount, quote is 6-decimal (USDC), normalize to
      // quote-per-whole-token in real units.
      price: (Number(t.quote) / 1e6) / (Number(t.tokens) / 1e18),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return trades;
}

export const TIMEFRAMES = [
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "1h", seconds: 3600 },
  { label: "4h", seconds: 4 * 3600 },
  { label: "1d", seconds: 24 * 3600 },
] as const;

export type TimeframeLabel = (typeof TIMEFRAMES)[number]["label"];

/** Picks a bucket width that keeps candle count reasonable for the trade
 *  history's actual span, used as the default timeframe on first load. */
export function autoTimeframe(trades: Trade[]): TimeframeLabel {
  if (trades.length === 0) return "1h";
  const span = trades[trades.length - 1].timestamp - trades[0].timestamp;
  return (TIMEFRAMES.find((tf) => span / tf.seconds <= 60) ?? TIMEFRAMES[TIMEFRAMES.length - 1]).label;
}

/** Buckets trades into fixed-width candles at the given timeframe. */
export function tradesToCandles(trades: Trade[], timeframe: TimeframeLabel): Candle[] {
  if (trades.length === 0) return [];
  const bucketSeconds = TIMEFRAMES.find((tf) => tf.label === timeframe)!.seconds;

  const buckets = new Map<number, Trade[]>();
  for (const t of trades) {
    const bucketStart = Math.floor(t.timestamp / bucketSeconds) * bucketSeconds;
    const bucket = buckets.get(bucketStart) ?? [];
    bucket.push(t);
    buckets.set(bucketStart, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, bucketTrades]) => {
      const prices = bucketTrades.map((t) => t.price);
      return {
        time,
        open: prices[0],
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1],
      };
    });
}
