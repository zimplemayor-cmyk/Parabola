"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ADDRESS, LaunchFactoryAbi, BondingCurveAbi, LaunchTokenAbi } from "./contracts";

export interface LaunchSummary {
  token: `0x${string}`;
  curve: `0x${string}`;
  creator: `0x${string}`;
  vestingWallet: `0x${string}`;
  createdAt: bigint;
  isBuilderLaunch: boolean;
  metadataURI: string;
}

export function useCurveForToken(tokenAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: LaunchFactoryAbi,
    functionName: "curveForToken",
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: !!tokenAddress && !!FACTORY_ADDRESS },
  }) as { data: `0x${string}` | undefined; isLoading: boolean };
}

export function useTotalLaunches() {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: LaunchFactoryAbi,
    functionName: "totalLaunches",
    query: { enabled: !!FACTORY_ADDRESS },
  });
}

export function useLaunches(offset: number, limit: number) {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: LaunchFactoryAbi,
    functionName: "getLaunches",
    args: [BigInt(offset), BigInt(limit)],
    query: { enabled: !!FACTORY_ADDRESS },
  }) as { data: LaunchSummary[] | undefined; isLoading: boolean; error: Error | null };
}

export interface CurveData {
  tokensSold: bigint;
  curveSupply: bigint;
  realQuoteReserve: bigint;
  graduationThreshold: bigint;
  graduated: boolean;
  graduationExecuted: boolean;
  currentPrice: bigint;
  progressBps: bigint;
  creator: `0x${string}`;
}

/** Batches every view call for one curve into a single multicall. */
export function useCurveData(curveAddress: `0x${string}` | undefined) {
  const contract = { address: curveAddress, abi: BondingCurveAbi } as const;
  const { data, ...rest } = useReadContracts({
    contracts: curveAddress
      ? [
          { ...contract, functionName: "tokensSold" },
          { ...contract, functionName: "curveSupply" },
          { ...contract, functionName: "realQuoteReserve" },
          { ...contract, functionName: "graduationThreshold" },
          { ...contract, functionName: "graduated" },
          { ...contract, functionName: "graduationExecuted" },
          { ...contract, functionName: "getCurrentPrice" },
          { ...contract, functionName: "progressBps" },
          { ...contract, functionName: "creator" },
        ]
      : [],
    query: { enabled: !!curveAddress, refetchInterval: 12_000 },
  });

  const curve: CurveData | undefined =
    data && data.every((d) => d.result !== undefined)
      ? {
          tokensSold: data[0]!.result as bigint,
          curveSupply: data[1]!.result as bigint,
          realQuoteReserve: data[2]!.result as bigint,
          graduationThreshold: data[3]!.result as bigint,
          graduated: data[4]!.result as boolean,
          graduationExecuted: data[5]!.result as boolean,
          currentPrice: data[6]!.result as bigint,
          progressBps: data[7]!.result as bigint,
          creator: data[8]!.result as `0x${string}`,
        }
      : undefined;

  return { curve, ...rest };
}

export function useTokenMeta(tokenAddress: `0x${string}` | undefined) {
  const LaunchTokenAbi = require("./abis/LaunchToken.json");
  const contract = { address: tokenAddress, abi: LaunchTokenAbi } as const;
  const { data, ...rest } = useReadContracts({
    contracts: tokenAddress
      ? [
          { ...contract, functionName: "name" },
          { ...contract, functionName: "symbol" },
          { ...contract, functionName: "totalSupply" },
        ]
      : [],
    query: { enabled: !!tokenAddress },
  });
  return {
    name: data?.[0]?.result as string | undefined,
    symbol: data?.[1]?.result as string | undefined,
    totalSupply: data?.[2]?.result as bigint | undefined,
    ...rest,
  };
}
