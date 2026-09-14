"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/chains";

/**
 * Wagmi's injected-connector switchChain implementation already falls back
 * to `wallet_addEthereumChain` (passing rpcUrls/blockExplorerUrls/
 * nativeCurrency straight from the chain object registered in
 * lib/wagmi.ts) when the wallet responds that it doesn't recognize the
 * chain yet — so one call here covers both "switch" and "add + switch"
 * without this component needing to know which case it is.
 */
export function SwitchNetworkButton({ className = "" }: { className?: string }) {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();

  if (!isConnected || chainId === activeChain.id) return null;

  return (
    <div className={className}>
      <button
        onClick={() => switchChain({ chainId: activeChain.id })}
        disabled={isPending}
        className="rounded-full bg-ignite px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-ignite-soft disabled:opacity-60"
      >
        {isPending ? "Check your wallet…" : `Switch to ${activeChain.name}`}
      </button>
      {error && <p className="mt-1.5 text-xs text-ignite">{error.message.slice(0, 140)}</p>}
    </div>
  );
}
