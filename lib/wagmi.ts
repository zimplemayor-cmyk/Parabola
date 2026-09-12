import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { arcMainnet, arcTestnet } from "./chains";

const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Injected (MetaMask, Rabby, Coinbase Wallet extension, etc.) needs zero
// external setup and is the primary path. WalletConnect is included only
// when a project ID is configured, so a fresh clone of this repo works
// immediately without requiring a WalletConnect Cloud signup first — see
// README.md "Environment variables" for how to add one later.
export const wagmiConfig = createConfig({
  chains: [arcTestnet, arcMainnet],
  connectors: [injected(), ...(wcProjectId ? [walletConnect({ projectId: wcProjectId })] : [])],
  transports: {
    [arcTestnet.id]: http(),
    [arcMainnet.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
