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

export function explorerAddressUrl(address: string) {
  return `${activeChain.blockExplorers.default.url}/address/${address}`;
}

export function explorerTxUrl(hash: string) {
  return `${activeChain.blockExplorers.default.url}/tx/${hash}`;
}
