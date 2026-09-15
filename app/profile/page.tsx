"use client";

import { useAccount, useBalance } from "wagmi";
import { useCreatorLaunches } from "@/lib/hooks";
import { formatNativeBalance, formatAddress } from "@/lib/format";
import { ProfileTokenRow } from "@/components/ProfileTokenRow";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { launches, isLoading, truncated } = useCreatorLaunches(address);

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-paper-dim">Connect your wallet to see your profile.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="label-caps">Profile</p>
      <h1 className="mt-1 font-mono text-2xl font-semibold text-paper">{formatAddress(address!)}</h1>

      <div className="card mt-6 p-6">
        <p className="label-caps">Wallet balance</p>
        <p className="mt-1 font-mono text-3xl text-paper">
          {balance ? `${formatNativeBalance(balance.value)} USDC` : "…"}
        </p>
      </div>

      <h2 className="mt-10 font-display text-lg font-semibold text-paper">Your launches</h2>
      <p className="mt-1 text-xs text-paper-faint">
        &quot;Fees earned&quot; is a running total already sitting in your wallet, credited automatically on
        every trade, there&apos;s no separate claim step. Holdings shown here cover tokens you&apos;ve created;
        tokens you&apos;ve only bought don&apos;t have a portfolio view yet.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-sm text-paper-faint">Loading…</p>
        ) : launches.length === 0 ? (
          <p className="text-sm text-paper-faint">You haven&apos;t launched a token on Parabola yet.</p>
        ) : (
          launches.map((l) => <ProfileTokenRow key={l.token} launch={l} address={address!} />)
        )}
      </div>
      {truncated && (
        <p className="mt-3 text-xs text-paper-faint">
          Only scanning the most recent launches platform-wide right now, older ones may not show up here yet.
        </p>
      )}
    </div>
  );
}
