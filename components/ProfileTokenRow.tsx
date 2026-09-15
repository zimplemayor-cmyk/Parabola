"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useReadContract } from "wagmi";
import Link from "next/link";
import { useCurveData, useTokenMeta, useLaunchMetadata, type LaunchSummary } from "@/lib/hooks";
import { fetchCreatorFeesEarned } from "@/lib/trades";
import { formatQuote, formatToken } from "@/lib/format";
import { LaunchTokenAbi } from "@/lib/contracts";

export function ProfileTokenRow({ launch, address }: { launch: LaunchSummary; address: `0x${string}` }) {
  const { name, symbol } = useTokenMeta(launch.token);
  const { curve } = useCurveData(launch.curve);
  const { imageUrl } = useLaunchMetadata(launch.metadataURI);
  const client = usePublicClient();
  const [feesEarned, setFeesEarned] = useState<bigint | null>(null);

  const { data: ownBalance } = useReadContract({
    address: launch.token,
    abi: LaunchTokenAbi,
    functionName: "balanceOf",
    args: [address],
  }) as { data: bigint | undefined };

  useEffect(() => {
    if (!client || !curve) return;
    let cancelled = false;
    fetchCreatorFeesEarned(client, launch.curve, 0n, curve.creatorFeeBps, curve.protocolFeeBps)
      .then((fees) => {
        if (!cancelled) setFeesEarned(fees);
      })
      .catch(() => {
        if (!cancelled) setFeesEarned(0n);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- curve is a fresh object every poll (refetchInterval), only its bps values and the curve address should re-trigger this
  }, [client, launch.curve, curve?.creatorFeeBps, curve?.protocolFeeBps]);

  const status = !curve
    ? "…"
    : curve.graduationExecuted
      ? "Graduated"
      : curve.graduated
        ? "Graduating"
        : "Trading";

  return (
    <Link
      href={`/token/${launch.token}`}
      className="card flex items-center justify-between gap-4 p-4 transition hover:border-ignite/40"
    >
      <div className="flex items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-surface text-sm font-semibold text-paper-faint">
            {(symbol ?? name ?? "?").slice(0, 1)}
          </div>
        )}
        <div>
          <p className="font-display text-sm font-semibold text-paper">{name ?? "…"}</p>
          <p className="label-caps mt-0.5">${symbol ?? "…"} · {status}</p>
        </div>
      </div>
      <div className="flex gap-6 text-right text-xs">
        <div>
          <p className="text-paper-faint">Your holdings</p>
          <p className="mt-0.5 font-mono text-paper">
            {ownBalance !== undefined ? formatToken(ownBalance, { compact: true }) : "…"}
          </p>
        </div>
        <div>
          <p className="text-paper-faint">Fees earned</p>
          <p className="mt-0.5 font-mono text-stable">
            {feesEarned !== null ? `${formatQuote(feesEarned)} USDC` : "…"}
          </p>
        </div>
      </div>
    </Link>
  );
}
