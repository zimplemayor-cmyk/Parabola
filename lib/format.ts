import { formatUnits, parseUnits } from "viem";

/** Arc's native currency (USDC) uses 6 decimals, see lib/chains.ts. */
export const QUOTE_DECIMALS = 6;
/** Every LaunchToken is a standard 18-decimal ERC20. */
export const TOKEN_DECIMALS = 18;

export function formatQuote(value: bigint, opts: { compact?: boolean } = {}): string {
  const n = Number(formatUnits(value, QUOTE_DECIMALS));
  if (opts.compact) return compactNumber(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function parseQuote(value: string): bigint {
  return parseUnits(value || "0", QUOTE_DECIMALS);
}

/**
 * parseUnits throws on input that's transiently invalid while someone is
 * still typing (empty string, a bare "-", "1.", multiple decimal points).
 * Trade inputs call this on every keystroke via a debounce, so it returns
 * undefined instead of throwing rather than crashing the input on each
 * partial keystroke.
 */
export function parseUnitsSafe(value: string, decimals: number): bigint | undefined {
  if (!value || !/^\d*\.?\d*$/.test(value) || value === "." ) return undefined;
  try {
    return parseUnits(value, decimals);
  } catch {
    return undefined;
  }
}

export function formatToken(value: bigint, opts: { compact?: boolean } = {}): string {
  const n = Number(formatUnits(value, TOKEN_DECIMALS));
  if (opts.compact) return compactNumber(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function bpsToPercent(bps: bigint | number): string {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

/**
 * Token metadata images are commonly stored as ipfs:// URIs. next/image (and
 * plain <img>) can't fetch that scheme directly, so resolve it to an https
 * gateway URL first. Swap the default gateway via NEXT_PUBLIC_IPFS_GATEWAY
 * if you'd rather run/point at your own.
 */
export function resolveImageUrl(uri: string | undefined | null): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs/";
    return gateway + uri.replace("ipfs://", "");
  }
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  return null;
}
