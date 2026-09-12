"use client";

import { useState } from "react";
import { useLaunches, useTotalLaunches } from "@/lib/hooks";
import { TokenCard } from "@/components/TokenCard";
import { FACTORY_CONFIGURED } from "@/lib/contracts";
import Link from "next/link";

const PAGE_SIZE = 24;

export default function ExplorePage() {
  const [page, setPage] = useState(0);
  const { data: total } = useTotalLaunches();
  const { data: launches, isLoading } = useLaunches(page * PAGE_SIZE, PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-paper">Explore</h1>
          <p className="mt-1 text-paper-dim">
            {typeof total === "bigint"
              ? `${total.toString()} launch${total === 1n ? "" : "es"} on Parabola`
              : "Reading launches from Arc…"}
          </p>
        </div>
        <Link href="/launch" className="btn-primary text-sm">
          Launch a token
        </Link>
      </div>

      {!FACTORY_CONFIGURED && (
        <div className="mt-8 rounded-xl border border-ignite/30 bg-ignite/5 p-4 text-sm text-ignite-soft">
          No factory address configured yet. Deploy the contracts and set{" "}
          <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_FACTORY_ADDRESS</code> in{" "}
          <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-xs">.env</code> to see real launches here.
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {launches?.map((launch) => (
          <TokenCard key={launch.curve} launch={launch} />
        ))}
      </div>

      {FACTORY_CONFIGURED && !isLoading && launches?.length === 0 && (
        <div className="mt-16 text-center text-paper-dim">
          <p>Nothing launched yet.</p>
          <Link href="/launch" className="mt-3 inline-block text-ignite-soft hover:underline">
            Be the first →
          </Link>
        </div>
      )}

      {typeof total === "bigint" && total > BigInt(PAGE_SIZE) && (
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
            disabled={(page + 1) * PAGE_SIZE >= Number(total)}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
