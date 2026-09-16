"use client";

import { useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import Link from "next/link";
import { useCurveData, useTokenMeta, useLaunchMetadata, type LaunchSummary } from "@/lib/hooks";
import { formatQuote, formatToken } from "@/lib/format";
import { LaunchTokenAbi, BondingCurveAbi } from "@/lib/contracts";

export function ProfileTokenRow({
  launch,
  address,
  onFeesLoaded,
}: {
  launch: LaunchSummary;
  address: `0x${string}`;
  onFeesLoaded?: (token: string, fees: bigint) => void;
}) {
  const { name, symbol } = useTokenMeta(launch.token);
  const { curve } = useCurveData(launch.curve);
  const { imageUrl } = useLaunchMetadata(launch.metadataURI);

  const { data: ownBalance } = useReadContract({
    address: launch.token,
    abi: LaunchTokenAbi,
    functionName: "balanceOf",
    args: [address],
  }) as { data: bigint | undefined };

  const { data: pendingFees, refetch: refetchFees } = useReadContract({
    address: launch.curve,
    abi: BondingCurveAbi,
    functionName: "pendingCreatorFees",
    query: { refetchInterval: 15_000 },
  }) as { data: bigint | undefined; refetch: () => void };

  useEffect(() => {
    if (pendingFees !== undefined) onFeesLoaded?.(launch.token, pendingFees);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onFeesLoaded is stable from the parent's useCallback; re-running on it would just re-report the same value
  }, [pendingFees, launch.token]);

  const { writeContract, data: claimHash, isPending: claiming } = useWriteContract();
  const { isLoading: confirmingClaim, isSuccess: claimed } = useWaitForTransactionReceipt({ hash: claimHash });

  useEffect(() => {
    if (claimed) refetchFees();
  }, [claimed, refetchFees]);

  const isCreator = curve?.creator?.toLowerCase() === address.toLowerCase();
  const hasClaimable = pendingFees !== undefined && pendingFees > 0n;

  const status = !curve
    ? "…"
    : curve.graduationExecuted
      ? "Graduated"
      : curve.graduated
        ? "Graduating"
        : "Trading";

  return (
    <div className="card flex items-center justify-between gap-4 p-4 transition hover:border-ignite/40">
      <Link href={`/token/${launch.token}`} className="flex min-w-0 items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-surface text-sm font-semibold text-paper-faint">
            {(symbol ?? name ?? "?").slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-paper">{name ?? "…"}</p>
          <p className="label-caps mt-0.5">${symbol ?? "…"} · {status}</p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-5 text-right text-xs">
        <div>
          <p className="text-paper-faint">Your holdings</p>
          <p className="mt-0.5 font-mono text-paper">
            {ownBalance !== undefined ? formatToken(ownBalance, { compact: true }) : "…"}
          </p>
        </div>
        <div>
          <p className="text-paper-faint">Claimable</p>
          <p className="mt-0.5 font-mono text-stable">
            {pendingFees !== undefined ? `${formatQuote(pendingFees)} USDC` : "…"}
          </p>
        </div>
        {isCreator && (
          <button
            disabled={!hasClaimable || claiming || confirmingClaim}
            onClick={() =>
              writeContract({ address: launch.curve, abi: BondingCurveAbi, functionName: "claimCreatorFees" })
            }
            className="rounded-full bg-ignite px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-ignite-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {claiming ? "Confirm…" : confirmingClaim ? "Claiming…" : "Claim"}
          </button>
        )}
      </div>
    </div>
  );
}
