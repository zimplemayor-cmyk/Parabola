"use client";

import { use } from "react";
import { useCurveForToken, useCurveData, useTokenMeta, useMetadataURIForToken, useLaunchMetadata } from "@/lib/hooks";
import { TradePanel } from "@/components/TradePanel";
import { PriceChart } from "@/components/PriceChart";
import { formatAddress, formatQuote, formatToken, bpsToPercent } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/contracts";

export default function TokenPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const tokenAddress = address as `0x${string}`;
  const { data: curveAddress, isLoading: loadingCurve } = useCurveForToken(tokenAddress);
  const { name, symbol, totalSupply } = useTokenMeta(tokenAddress);
  const { curve } = useCurveData(curveAddress);
  const { metadataURI, creationBlock } = useMetadataURIForToken(tokenAddress);
  const { metadata, imageUrl } = useLaunchMetadata(metadataURI);

  if (!loadingCurve && curveAddress === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-paper-dim">No Parabola launch found for this token address.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ink-surface text-lg font-semibold text-paper-faint">
              {(symbol ?? name ?? "?").slice(0, 1)}
            </div>
          )}
          <div>
            <p className="label-caps">${symbol ?? "…"}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-paper">{name ?? "Loading…"}</h1>
            <a
              href={explorerAddressUrl(tokenAddress)}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-block font-mono text-xs text-paper-faint hover:text-stable"
            >
              {formatAddress(tokenAddress)} ↗
            </a>
          </div>
        </div>
        <div className="flex gap-6 text-right">
          <Stat label="Price" value={curve ? formatMicroPrice(curve.currentPrice) : "…"} />
          <Stat label="Raised" value={curve ? `${formatQuote(curve.realQuoteReserve, { compact: true })} USDC` : "…"} />
          <Stat
            label="Progress"
            value={curve ? (curve.graduated ? "Graduated" : bpsToPercent(curve.progressBps)) : "…"}
          />
        </div>
      </div>

      {metadata?.description && <p className="mt-4 max-w-2xl text-sm text-paper-dim">{metadata.description}</p>}

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_360px]">
        <div className="card p-6">
          <PriceChart
            curveAddress={curveAddress}
            fromBlock={creationBlock}
            progress={curve ? Number(curve.progressBps) / 10_000 : 0}
            totalSupply={totalSupply}
          />
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-border pt-6 text-sm sm:grid-cols-4">
            <Detail label="Total supply" value={totalSupply ? formatToken(totalSupply, { compact: true }) : "…"} />
            <Detail
              label="Graduation at"
              value={curve ? `${formatQuote(curve.graduationThreshold, { compact: true })} USDC` : "…"}
            />
            <Detail label="Creator" value={curve ? formatAddress(curve.creator) : "…"} />
            <Detail label="Status" value={curve?.graduated ? "Graduated" : "Trading"} />
          </dl>
        </div>

        <div>
          {curveAddress && curveAddress !== "0x0000000000000000000000000000000000000000" ? (
            <TradePanel curveAddress={curveAddress} tokenAddress={tokenAddress} curve={curve} symbol={symbol ?? ""} />
          ) : (
            <div className="card p-6 text-sm text-paper-dim">Loading trading panel…</div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMicroPrice(scaledPrice: bigint): string {
  // getCurrentPrice() returns quote-smallest-units per whole token, scaled
  // by 1e36 for precision (see BondingCurve.sol). Unscale to a real
  // dollar-ish figure: divide by 1e36, then by 1e6 quote-decimals more to
  // land in whole-USDC terms.
  const asNumber = Number(scaledPrice) / 1e36 / 1e6;
  if (asNumber === 0) return "$0.00";
  if (asNumber < 0.01) return `$${asNumber.toExponential(2)}`;
  return `$${asNumber.toFixed(4)}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-mono text-sm text-paper">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 font-mono text-paper">{value}</dd>
    </div>
  );
}
