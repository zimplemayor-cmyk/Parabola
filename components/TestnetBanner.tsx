"use client";

import { useState } from "react";
import { activeChain } from "@/lib/chains";

const FAUCET_URL = "https://faucet.circle.com";

/**
 * Shown only while activeChain is a testnet (see lib/chains.ts — driven by
 * NEXT_PUBLIC_USE_MAINNET). Every Arc transaction, including just creating
 * a token, pays gas in USDC itself — so on testnet there is no "browse
 * first, fund later" path. A new wallet can't do anything here, not even
 * look at a quote that requires a read through a connected wallet's own
 * chain, without testnet USDC first. This banner needs no changes at
 * mainnet switchover: once NEXT_PUBLIC_USE_MAINNET=true, activeChain.testnet
 * is false and this renders nothing.
 */
export function TestnetBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (!activeChain.testnet || dismissed) return null;

  return (
    <div className="border-b border-stable/25 bg-stable/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2.5 text-sm">
        <p className="text-stable">
          Running on <strong className="font-medium">{activeChain.name}</strong> — you&apos;ll need free testnet
          USDC in your wallet to pay gas or trade here.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full bg-stable px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-stable-soft"
          >
            Get testnet USDC
          </a>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="text-stable/60 transition hover:text-stable"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
