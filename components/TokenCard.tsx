"use client";

import Link from "next/link";
import { useCurveData, useTokenMeta, useLaunchMetadata, type LaunchSummary } from "@/lib/hooks";
import { formatQuote, bpsToPercent } from "@/lib/format";

export function TokenCard({ launch }: { launch: LaunchSummary }) {
  const { name, symbol } = useTokenMeta(launch.token);
  const { curve } = useCurveData(launch.curve);
  const { imageUrl } = useLaunchMetadata(launch.metadataURI);

  return (
    <Link
      href={`/token/${launch.token}`}
      className="card group flex flex-col gap-4 p-5 transition hover:border-ignite/40"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-surface text-sm font-semibold text-paper-faint">
              {(symbol ?? name ?? "?").slice(0, 1)}
            </div>
          )}
          <div>
            <p className="font-display text-base font-semibold text-paper group-hover:text-ignite-soft">
              {name ?? "…"}
            </p>
            <p className="label-caps mt-0.5">${symbol ?? "…"}</p>
          </div>
        </div>
        {launch.isBuilderLaunch ? (
          <span className="rounded-full bg-stable/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-stable">
            Builder
          </span>
        ) : (
          <span className="rounded-full bg-ignite/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-ignite-soft">
            Meme
          </span>
        )}
      </div>

      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-border">
          <div
            className={`h-full rounded-full ${curve?.graduated ? "bg-stable" : "bg-ignite"}`}
            style={{ width: `${curve ? Number(curve.progressBps) / 100 : 0}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-paper-faint">
            {curve?.graduated ? "Graduated" : curve ? `${bpsToPercent(curve.progressBps)} to graduation` : "…"}
          </span>
          <span className="font-mono text-paper-dim">
            {curve ? `${formatQuote(curve.realQuoteReserve, { compact: true })} USDC raised` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
