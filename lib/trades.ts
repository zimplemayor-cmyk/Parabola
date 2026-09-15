import type { PublicClient } from "viem";
import { BondingCurveAbi } from "./contracts";
import { getLogsChunked } from "./onchainLogs";

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
 * Reads every Buy/Sell event a curve has emitted, from its own creation
 * block (never block 0 or "earliest", both of which most providers reject
 * or choke on for a chain this many blocks deep) up to the current block,
 * in bounded chunks, and derives an implied trade price from each
 * (quoteIn/tokensOut for buys, quoteOut/tokensIn for sells): real executed
 * prices, not the theoretical curve shape. This is a client-side read of
 * contract logs; there's no backend indexer behind it, so on a brand-new or
 * quiet token this can come back with very few (or zero) trades. Callers
 * should handle that case explicitly rather than rendering an empty or
 * misleading chart.
 */
export async function fetchTrades(
  client: PublicClient,
  curveAddress: `0x${string}`,
  fromBlock: bigint = 0n
): Promise<Trade[]> {
  const anyClient = client as any;
  const latest: bigint = await anyClient.getBlockNumber();
  const [buyLogs, sellLogs] = await Promise.all([
    getLogsChunked(anyClient, { address: curveAddress, abi: BondingCurveAbi, eventName: "Buy" }, fromBlock, latest),
    getLogsChunked(anyClient, { address: curveAddress, abi: BondingCurveAbi, eventName: "Sell" }, fromBlock, latest),
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

  // Timestamps by interpolation, not one getBlock call per unique trade
  // block. Fetching a real timestamp for every block a token with hundreds
  // of trades touched is the difference between this loading in under a
  // second and visibly hanging. Arc's block time is documented as a
  // constant ~500ms, so two reference points (the latest block, and either
  // the earliest trade's block or 5000 blocks back, whichever is older)
  // give an accurate seconds-per-block rate without scanning every block
  // in between.
  const minBlock = raw.reduce((min, t) => (t.blockNumber < min ? t.blockNumber : min), raw[0].blockNumber);
  const referenceStart = minBlock < latest - 5000n ? minBlock : latest - 5000n > 0n ? latest - 5000n : 0n;
  const [latestBlockInfo, startBlockInfo] = await Promise.all([
    client.getBlock({ blockNumber: latest }),
    client.getBlock({ blockNumber: referenceStart }),
  ]);
  const blockSpan = latest - referenceStart;
  const secondsPerBlock =
    blockSpan > 0n ? (Number(latestBlockInfo.timestamp) - Number(startBlockInfo.timestamp)) / Number(blockSpan) : 0.5;
  const latestTimestamp = Number(latestBlockInfo.timestamp);

  const trades: Trade[] = raw
    .map((t) => ({
      blockNumber: t.blockNumber,
      timestamp: Math.round(latestTimestamp - Number(latest - t.blockNumber) * secondsPerBlock),
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
