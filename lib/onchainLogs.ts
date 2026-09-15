const MAX_CHUNK_BLOCKS = 5_000n;

/**
 * Fetches logs for one event across a block range in bounded chunks.
 * Arc's RPC providers reject or silently time out on a single unbounded
 * "0 to latest" query (testnet alone is tens of millions of blocks at
 * ~2 blocks/sec), so every historical scan in this app goes through here
 * instead of calling client.getLogs directly with a wide range. Halves the
 * chunk size and retries on a range-rejected error rather than assuming a
 * fixed limit that may not match every provider.
 */
export async function getLogsChunked(
  client: any,
  params: { address: `0x${string}`; abi: any; eventName: string; args?: Record<string, unknown> },
  fromBlock: bigint,
  toBlock: bigint
): Promise<any[]> {
  const results: any[] = [];
  let cursor = fromBlock;
  let chunk = MAX_CHUNK_BLOCKS;

  while (cursor <= toBlock) {
    const end = cursor + chunk > toBlock ? toBlock : cursor + chunk;
    try {
      const logs = await client.getLogs({ ...params, fromBlock: cursor, toBlock: end });
      results.push(...logs);
      cursor = end + 1n;
    } catch (err) {
      if (chunk <= 50n) throw err; // too small to shrink further, a real error, not a range limit
      chunk = chunk / 4n;
    }
  }
  return results;
}
