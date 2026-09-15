"use client";

import { useCallback, useState } from "react";
import { useBalance } from "wagmi";
import { useCreatorLaunches } from "@/lib/hooks";
import { formatNativeBalance, formatQuote, formatAddress } from "@/lib/format";
import { ProfileTokenRow } from "@/components/ProfileTokenRow";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-display text-2xl text-paper">{value}</p>
    </div>
  );
}

export function ProfileView({ address, isOwnProfile }: { address: `0x${string}`; isOwnProfile: boolean }) {
  const { data: balance } = useBalance({ address });
  const { launches, isLoading, truncated } = useCreatorLaunches(address);
  const [tab, setTab] = useState<"created" | "holdings">("created");
  const [copied, setCopied] = useState(false);

  const holdings = launches; // ProfileTokenRow fetches per-token balance; both tabs share the same underlying list for now
  const [feesByToken, setFeesByToken] = useState<Record<string, bigint>>({});
  const onFeesLoaded = useCallback((token: string, fees: bigint) => {
    setFeesByToken((prev) => (prev[token] === fees ? prev : { ...prev, [token]: fees }));
  }, []);
  const totalFees = Object.values(feesByToken).reduce((sum, f) => sum + f, 0n);
  const feesKnownForAll = launches.length > 0 && launches.every((l) => feesByToken[l.token] !== undefined);

  function sharePayoutLink() {
    navigator.clipboard.writeText(`${window.location.origin}/profile/${address}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label-caps">{isOwnProfile ? "Your profile" : "Profile"}</p>
          <h1 className="mt-1 font-mono text-2xl font-semibold text-paper">{formatAddress(address)}</h1>
        </div>
        <button onClick={sharePayoutLink} className="btn-secondary text-sm">
          {copied ? "Link copied" : "Public payout page"}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Wallet balance" value={balance ? `${formatNativeBalance(balance.value, { compact: true })} USDC` : "…"} />
        <StatCard label="Launched" value={isLoading ? "…" : String(launches.length)} />
        <StatCard
          label="Fees earned"
          value={launches.length === 0 ? "$0" : feesKnownForAll ? `${formatQuote(totalFees)} USDC` : "…"}
        />
      </div>

      <div className="mt-10 flex gap-2">
        <button
          onClick={() => setTab("created")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            tab === "created" ? "bg-ink-surface text-paper" : "text-paper-faint hover:text-paper-dim"
          }`}
        >
          Created ({launches.length})
        </button>
        <button
          onClick={() => setTab("holdings")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            tab === "holdings" ? "bg-ink-surface text-paper" : "text-paper-faint hover:text-paper-dim"
          }`}
        >
          Holdings
        </button>
      </div>
      {tab === "holdings" && (
        <p className="mt-2 text-xs text-paper-faint">
          Showing holdings in tokens {isOwnProfile ? "you've" : "this wallet has"} created. Tokens only bought,
          never created, don&apos;t have a portfolio view yet.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-sm text-paper-faint">Loading…</p>
        ) : launches.length === 0 ? (
          <p className="text-sm text-paper-faint">
            {isOwnProfile ? "You haven't" : "This wallet hasn't"} launched a token on Parabola yet.
          </p>
        ) : (
          (tab === "created" ? launches : holdings).map((l) => (
            <ProfileTokenRow key={l.token} launch={l} address={address} onFeesLoaded={onFeesLoaded} />
          ))
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
