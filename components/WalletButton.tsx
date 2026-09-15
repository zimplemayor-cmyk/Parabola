"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { useState, useRef, useEffect } from "react";
import { formatAddress, formatNativeBalance } from "@/lib/format";
import { SwitchNetworkButton } from "./SwitchNetworkButton";

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!isConnected) {
    const injectedConnector = connectors.find((c) => c.id === "injected") ?? connectors[0];
    return (
      <button
        onClick={() => injectedConnector && connect({ connector: injectedConnector })}
        disabled={isPending}
        className="btn-primary text-sm disabled:opacity-60"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setOpen((v) => !v)} className="btn-secondary text-sm">
        <span className="h-2 w-2 rounded-full bg-stable" />
        {address ? formatAddress(address) : ""}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-ink-border bg-ink-surface p-3 shadow-xl">
          <p className="label-caps">{chain?.name ?? "Unknown network"}</p>
          <SwitchNetworkButton className="mt-2" />
          <p className="mt-2 font-mono text-sm text-paper">
            {balance ? `${formatNativeBalance(balance.value)} USDC` : "N/A"}
          </p>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="mt-3 block w-full rounded-lg border border-ink-border py-2 text-center text-sm text-paper-dim transition hover:border-stable/50 hover:text-stable"
          >
            View profile
          </Link>
          <button
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="mt-2 w-full rounded-lg border border-ink-border py-2 text-sm text-paper-dim transition hover:border-ignite/50 hover:text-ignite"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
