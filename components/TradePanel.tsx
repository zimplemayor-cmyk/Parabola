"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { BondingCurveAbi, LaunchTokenAbi } from "@/lib/contracts";
import { formatQuote, formatToken, parseUnitsSafe } from "@/lib/format";
import type { CurveData } from "@/lib/hooks";

const SLIPPAGE_BPS = 100n; // 1% default tolerance

export function TradePanel({
  curveAddress,
  tokenAddress,
  curve,
  symbol,
}: {
  curveAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  curve: CurveData | undefined;
  symbol: string;
}) {
  const { address, isConnected } = useAccount();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(amount), 300);
    return () => clearTimeout(t);
  }, [amount]);

  const { data: usdcBalance } = useBalance({ address });
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: LaunchTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const { data: allowance } = useReadContract({
    address: tokenAddress,
    abi: LaunchTokenAbi,
    functionName: "allowance",
    args: address ? [address, curveAddress] : undefined,
    query: { enabled: !!address && side === "sell" },
  });

  const parsedAmount =
    side === "buy" ? parseUnitsSafe(debounced, 6) : parseUnitsSafe(debounced, 18);

  const { data: quote } = useReadContract({
    address: curveAddress,
    abi: BondingCurveAbi,
    functionName: side === "buy" ? "quoteBuy" : "quoteSell",
    args: parsedAmount ? [parsedAmount] : undefined,
    query: { enabled: !!parsedAmount && parsedAmount > 0n },
  });

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Clearing the amount field on success is local component state, so it's
  // safe to adjust directly during render (React's documented pattern for
  // "reset state when a condition changes", see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  // React bails out once amount is already "", so this doesn't loop.
  if (isSuccess && amount !== "") {
    setAmount("");
  }

  // Resetting wagmi's own mutation state is a call into an external system,
  // not local state, that one genuinely belongs in an effect.
  useEffect(() => {
    if (isSuccess) reset();
  }, [isSuccess, reset]);

  if (curve?.graduated) {
    return (
      <div className="card p-6 text-center">
        <p className="text-stable">This token graduated to a public DEX pool.</p>
        <p className="mt-1 text-sm text-paper-dim">Trade it there. The curve here is permanently closed.</p>
      </div>
    );
  }

  const needsApproval = side === "sell" && parsedAmount && (allowance === undefined || (allowance as bigint) < parsedAmount);

  function minOut(): bigint {
    if (!quote) return 0n;
    return ((quote as bigint) * (10_000n - SLIPPAGE_BPS)) / 10_000n;
  }

  function submit() {
    if (!parsedAmount || !address) return;
    if (side === "buy") {
      writeContract({
        address: curveAddress,
        abi: BondingCurveAbi,
        functionName: "buy",
        args: [address, minOut()],
        value: parsedAmount,
      });
    } else if (needsApproval) {
      writeContract({
        address: tokenAddress,
        abi: LaunchTokenAbi,
        functionName: "approve",
        args: [curveAddress, parsedAmount],
      });
    } else {
      writeContract({
        address: curveAddress,
        abi: BondingCurveAbi,
        functionName: "sell",
        args: [parsedAmount, minOut(), address],
      });
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-5 flex rounded-full border border-ink-border p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setAmount("");
            }}
            className={`flex-1 rounded-full py-2 text-sm font-medium capitalize transition ${
              side === s
                ? s === "buy"
                  ? "bg-ignite text-ink"
                  : "bg-stable text-ink"
                : "text-paper-dim hover:text-paper"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          className="input-field pr-20 text-lg"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-paper-faint">
          {side === "buy" ? "USDC" : symbol}
        </span>
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-paper-faint">
        <span>
          Balance:{" "}
          {side === "buy"
            ? usdcBalance
              ? `${formatQuote(usdcBalance.value)} USDC`
              : "N/A"
            : tokenBalance !== undefined
              ? `${formatToken(tokenBalance as bigint, { compact: true })} ${symbol}`
              : "N/A"}
        </span>
        {quote !== undefined && parsedAmount ? (
          <span>
            ≈ {side === "buy" ? formatToken(quote as bigint, { compact: true }) : formatQuote(quote as bigint)}{" "}
            {side === "buy" ? symbol : "USDC"}
          </span>
        ) : null}
      </div>

      {error && <p className="mt-4 text-xs text-ignite-soft">{error.message.slice(0, 200)}</p>}

      <button
        onClick={submit}
        disabled={!isConnected || !parsedAmount || parsedAmount === 0n || isPending || isConfirming}
        className={`btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50 ${
          side === "sell" ? "bg-stable hover:bg-stable-soft" : ""
        }`}
      >
        {!isConnected
          ? "Connect wallet"
          : isPending
            ? "Confirm in wallet…"
            : isConfirming
              ? "Confirming…"
              : needsApproval
                ? `Approve ${symbol}`
                : side === "buy"
                  ? "Buy"
                  : "Sell"}
      </button>
      <p className="mt-3 text-center text-[11px] text-paper-faint">1% slippage tolerance · quote from the contract</p>
    </div>
  );
}
