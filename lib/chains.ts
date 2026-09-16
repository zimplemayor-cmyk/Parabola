import { defineChain } from "viem";

// ---------------------------------------------------------------------------
// Arc (by Circle) network definitions.
//
// Testnet values are cross-checked against Circle's own arc-node GitHub
// repo, docs.arc.network, and multiple independent RPC providers (Alchemy,
// GetBlock, dRPC) as of September 2026, consistent across all of them.
//
// Mainnet launches September 16, 2026. Chain ID 5042 is the most consistent
// figure available before launch (it's the testnet ID's obvious parent:
// 5042 vs 5042002), but it is NOT yet independently confirmed the way the
// testnet ID is. VERIFY against https://docs.arc.network the moment mainnet
// is live and update ARC_MAINNET_CHAIN_ID / the RPC URL below (or via
// NEXT_PUBLIC_ARC_MAINNET_* env vars) before pointing real users at it.
//
// Native currency: Arc's gas token is USDC itself, but its actual raw
// on-chain accounting is 18 decimals (the standard EVM "wei" convention),
// confirmed directly in Arc's own mainnet launch coverage on 2026-09-16 —
// NOT 6 decimals like the separate ERC-20 USDC contract at
// 0x3600...0000. Getting this wrong is the single most common mistake
// integrating with Arc and silently breaks every balance/price display (or
// worse, every amount actually transferred) by a factor of 10^12 if
// missed. This app's own contracts (LaunchFactory/BondingCurve) and
// lib/format.ts's QUOTE_DECIMALS are rescaled to match, see
// MAINNET_QUOTE_DECIMALS below and SECURITY.md.

export const ARC_NATIVE_CURRENCY = {
  name: "USDC",
  symbol: "USDC",
  decimals: 18,
} as const;

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: ARC_NATIVE_CURRENCY,
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_TESTNET_RPC || "https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const arcMainnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_MAINNET_CHAIN_ID || 5_042),
  name: "Arc",
  nativeCurrency: ARC_NATIVE_CURRENCY,
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_MAINNET_RPC || "https://rpc.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: process.env.NEXT_PUBLIC_ARC_MAINNET_EXPLORER || "https://arcscan.app" },
  },
  testnet: false,
});

export const activeChain = process.env.NEXT_PUBLIC_USE_MAINNET === "true" ? arcMainnet : arcTestnet;
