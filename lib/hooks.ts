"use client";

import { useEffect, useState } from "react";
import { useReadContract, useReadContracts, usePublicClient } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_DEPLOY_BLOCK, LaunchFactoryAbi, BondingCurveAbi, LaunchTokenAbi } from "./contracts";
import { resolveImageUrl } from "./format";
import { getLogsChunked } from "./onchainLogs";

export interface LaunchMetadata {
  name?: string;
  description?: string;
  image?: string;
  links?: { website?: string; x?: string; telegram?: string };
}

// Module-level cache: the same metadataURI is fetched by every TokenCard
// showing that launch plus its own token page, and the content behind an
// IPFS URI never changes, so there's no reason to re-fetch or invalidate.
const metadataCache = new Map<string, LaunchMetadata>();

/** Fetches a launch's metadata JSON (set via the upload flow in
 *  LaunchForm) and resolves its `image` field to a displayable URL. */
export function useLaunchMetadata(metadataURI: string | undefined) {
  const [metadata, setMetadata] = useState<LaunchMetadata | null>(
    metadataURI ? (metadataCache.get(metadataURI) ?? null) : null
  );

  useEffect(() => {
    if (!metadataURI) return;
    const cached = metadataCache.get(metadataURI);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronous cache hit, no async work needed
      setMetadata(cached);
      return;
    }
    const url = resolveImageUrl(metadataURI); // metadataURI itself is commonly ipfs://, same resolution as an image URI
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: LaunchMetadata | null) => {
        if (cancelled || !json) return;
        metadataCache.set(metadataURI, json);
        setMetadata(json);
      })
      .catch(() => {
        /* no metadata JSON at this URI, or it's unreachable, token page falls back to name/symbol only */
      });
    return () => {
      cancelled = true;
    };
  }, [metadataURI]);

  return { metadata, imageUrl: resolveImageUrl(metadata?.image) };
}

/** Looks up a single launch's metadataURI directly from its token address,
 *  via the indexed LaunchCreated log, used on the token detail page,
 *  which doesn't have the full LaunchSummary the explore list does. */
export function useMetadataURIForToken(tokenAddress: `0x${string}` | undefined) {
  const client = usePublicClient();
  const [metadataURI, setMetadataURI] = useState<string | undefined>();
  const [creationBlock, setCreationBlock] = useState<bigint | undefined>();

  useEffect(() => {
    if (!tokenAddress || !client || !FACTORY_ADDRESS) return;
    let cancelled = false;
    client
      .getBlockNumber()
      .then((latest: bigint) =>
        getLogsChunked(
          client,
          { address: FACTORY_ADDRESS, abi: LaunchFactoryAbi, eventName: "LaunchCreated", args: { token: tokenAddress } },
          FACTORY_DEPLOY_BLOCK,
          latest
        )
      )
      .then((logs: any[]) => {
        if (cancelled || logs.length === 0) return;
        setMetadataURI(logs[0].args.metadataURI as string);
        setCreationBlock(logs[0].blockNumber as bigint);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tokenAddress, client]);

  return { metadataURI, creationBlock };
}

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
  creatorFeeBps: bigint;
  protocolFeeBps: bigint;
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
          { ...contract, functionName: "creatorFeeBps" },
          { ...contract, functionName: "protocolFeeBps" },
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
          creatorFeeBps: data[9]!.result as bigint,
          protocolFeeBps: data[10]!.result as bigint,
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

const PROFILE_LAUNCH_SCAN_CAP = 500;

/**
 * Finds every launch created by a given wallet. Uses the existing paginated
 * getLaunches contract read (not a log scan), so it works the same way the
 * Explore page already does. Capped at the most recent
 * PROFILE_LAUNCH_SCAN_CAP launches platform-wide for now; fine at today's
 * scale, but if Parabola ever has thousands of launches this should move
 * to an indexed lookup instead of scanning the whole list client-side.
 */
export function useCreatorLaunches(creator: `0x${string}` | undefined) {
  const { data: total } = useTotalLaunches();
  const count = total ? Number(total) : 0;
  const offset = Math.max(0, count - PROFILE_LAUNCH_SCAN_CAP);
  const { data: launches, isLoading } = useLaunches(offset, count - offset);
  const mine = (launches ?? []).filter((l) => creator && l.creator.toLowerCase() === creator.toLowerCase());
  return { launches: mine, isLoading: isLoading || total === undefined, truncated: offset > 0 };
}

const EXPLORE_SCAN_CAP = 300;

export interface ExploreLaunch extends LaunchSummary {
  realQuoteReserve: bigint;
  graduated: boolean;
  progressBps: bigint;
}

/**
 * Fetches recent launches (capped, same bounded-scan approach as the
 * profile page) plus each one's raised amount in a single batched
 * multicall, rather than the per-card fetch every TokenCard already does
 * independently. Needed because sorting by "most raised" has to happen
 * before rendering, not per-card after the fact.
 */
export function useExploreLaunches() {
  const { data: total } = useTotalLaunches();
  const count = total ? Number(total) : 0;
  const offset = Math.max(0, count - EXPLORE_SCAN_CAP);
  const { data: launches, isLoading: loadingLaunches } = useLaunches(offset, count - offset);

  const curveContracts = (launches ?? []).map((l) => ({ address: l.curve, abi: BondingCurveAbi }) as const);
  const { data: curveResults, isLoading: loadingCurves } = useReadContracts({
    contracts: curveContracts.flatMap((c) => [
      { ...c, functionName: "realQuoteReserve" },
      { ...c, functionName: "graduated" },
      { ...c, functionName: "progressBps" },
    ]) as any,
    query: { enabled: (launches?.length ?? 0) > 0 },
  });

  const enriched: ExploreLaunch[] = (launches ?? []).map((l, i) => ({
    ...l,
    realQuoteReserve: (curveResults?.[i * 3]?.result as bigint) ?? 0n,
    graduated: (curveResults?.[i * 3 + 1]?.result as boolean) ?? false,
    progressBps: (curveResults?.[i * 3 + 2]?.result as bigint) ?? 0n,
  }));

  return { launches: enriched, isLoading: loadingLaunches || (loadingCurves && !curveResults), truncated: offset > 0 };
}
