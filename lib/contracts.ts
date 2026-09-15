import LaunchFactoryAbi from "./abis/LaunchFactory.json";
import BondingCurveAbi from "./abis/BondingCurve.json";
import LaunchTokenAbi from "./abis/LaunchToken.json";
import { activeChain } from "./chains";

export { LaunchFactoryAbi, BondingCurveAbi, LaunchTokenAbi };

/**
 * Set after running `npm run deploy:testnet` (or :mainnet) in /contracts,
 * see that command's console output, or contracts/deployments/*.json.
 */
export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || "") as `0x${string}`;

export const FACTORY_CONFIGURED = FACTORY_ADDRESS.length === 42;

/**
 * Set this (in .env, no NEXT_PUBLIC_ concerns here since it's not
 * sensitive) to the block number from the factory's deploy output. Every
 * factory-wide historical scan (e.g. "all launches by this creator") starts
 * here instead of block 0, since testnet alone is tens of millions of
 * blocks deep, that's the difference between a scan taking seconds versus
 * being rejected outright by the RPC. Defaults to 0 (still correct, just
 * slower) when unset.
 */
export const FACTORY_DEPLOY_BLOCK = process.env.NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK
  ? BigInt(process.env.NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK)
  : 0n;

export function explorerAddressUrl(address: string) {
  return `${activeChain.blockExplorers.default.url}/address/${address}`;
}

export function explorerTxUrl(hash: string) {
  return `${activeChain.blockExplorers.default.url}/tx/${hash}`;
}
