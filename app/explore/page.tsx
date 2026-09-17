"use client";

import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import Link from "next/link";
import { useExploreLaunches, type ExploreLaunch } from "@/lib/hooks";
import { countRecentTrades } from "@/lib/trades";
import { TokenCard } from "@/components/TokenCard";
import { FACTORY_CONFIGURED } from "@/lib/contracts";

const PAGE_SIZE = 24;
type SortMode = "latest" | "raised" | "trending";
// ~1 day of Arc blocks at its documented ~500ms block time. A block-count
// window rather than a wall-clock one, since deriving exact timestamps for
// every curve up front would mean the same expensive per-block lookups the
// chart already avoids, see lib/trades.ts.
const TRENDING_WINDOW_BLOCKS = 172_800n;

export default function ExplorePage() {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortMode>("latest");
  const { launches, isLoading, truncated } = useExploreLaunches();
  const publicClient = usePublicClient();
  const [tradeCounts, setTradeCounts] = useState<Record<string, number> | null>(null);
  const [countingTrending, setCountingTrending] = useState(false);

  useEffect(() => {
    if (sort !== "trending" || !publicClient || launches.length === 0 || tradeCounts) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off an async trend computation, not a synchronous setState
    setCountingTrending(true);
    (async () => {
      const latest = (await (publicClient as any).getBlockNumber()) as bigint;
      const since = latest > TRENDING_WINDOW_BLOCKS ? latest - TRENDING_WINDOW_BLOCKS : 0n;
      const counts = await Promise.all(
        launches.map((l) => countRecentTrades(publicClient, l.curve, since, latest).catch(() => 0))
      );
      if (cancelled) return;
      const map: Record<string, number> = {};
      launches.forEach((l, i) => (map[l.token] = counts[i]));
      setTradeCounts(map);
      setCountingTrending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sort, publicClient, launches, tradeCounts]);

  const sorted = useMemo(() => {
    const list = [...launches];
    if (sort === "latest") return list.reverse(); // getLaunches returns oldest-first
    if (sort === "raised") return list.sort((a, b) => (b.realQuoteReserve > a.realQuoteReserve ? 1 : -1));
    if (sort === "trending" && tradeCounts) {
      return list.sort((a, b) => (tradeCounts[b.token] ?? 0) - (tradeCounts[a.token] ?? 0));
    }
    return list.reverse();
  }, [launches, sort, tradeCounts]);

  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-paper">Explore</h1>
          <p className="mt-1 text-paper-dim">
            {launches.length > 0
              ? `${launches.length} launch${launches.length === 1 ? "" : "es"} on Parabola`
              : "Reading launches from Arc…"}
          </p>
        </div>
        <Link href="/launch" className="btn-primary text-sm">
          Launch a token
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(
          [
            ["latest", "Latest"],
            ["raised", "Most raised"],
            ["trending", "Trending"],
          ] as [SortMode, string][]
        ).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => {
              setSort(mode);
              setPage(0);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              sort === mode
                ? "border-ignite bg-ignite/10 text-ignite"
                : "border-ink-border text-paper-dim hover:border-ignite/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {sort === "trending" && (
        <p className="mt-2 text-xs text-paper-faint">
          {countingTrending
            ? "Counting recent trades across every token…"
            : "Ranked by number of trades in roughly the last day. Not USD volume, no price weighting, just real trade counts."}
        </p>
      )}
      {sort === "raised" && (
        <p className="mt-2 text-xs text-paper-faint">
          Ranked by total ever raised on each curve, not a recent window.
        </p>
      )}

      {!FACTORY_CONFIGURED && (
        <div className="mt-8 rounded-xl border border-ignite/30 bg-ignite/5 p-4 text-sm text-ignite-soft">
          No factory address configured yet. Deploy the contracts and set{" "}
          <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_FACTORY_ADDRESS</code> in{" "}
          <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-xs">.env</code> to see real launches here.
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((launch) => (
          <TokenCard key={launch.curve} launch={launch} />
        ))}
      </div>

      {FACTORY_CONFIGURED && !isLoading && launches.length === 0 && (
        <div className="mt-16 text-center text-paper-dim">
          <p>Nothing launched yet.</p>
          <Link href="/launch" className="mt-3 inline-block text-ignite-soft hover:underline">
            Be the first →
          </Link>
        </div>
      )}

      {sorted.length > PAGE_SIZE && (
        <div className="mt-10 flex justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * PAGE_SIZE >= sorted.length}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
      {truncated && (
        <p className="mt-4 text-center text-xs text-paper-faint">
          Only showing the most recent {sorted.length} launches platform-wide right now.
        </p>
      )}
    </div>
  );
}
