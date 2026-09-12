import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------------------
// Arc network parameters
//
// Testnet values below are confirmed against multiple independent sources
// (Circle's own arc-node GitHub repo, docs.arc.network, Alchemy, GetBlock,
// dRPC) as of September 2026.
//
// Mainnet values are NOT yet fully finalized publicly as of this writing —
// Arc mainnet goes live September 16, 2026. Chain ID 5042 is the most
// consistent figure found (The Graph's network registry ties it directly to
// docs.arc.network + USDC gas), but you MUST re-verify chainId/rpcUrl
// against https://docs.arc.network the moment mainnet is live, before
// deploying anything with real funds. Do not trust this file blindly —
// that is exactly the kind of unverified-config mistake that causes wallet
// and bridge failures. See SECURITY.md, section "Pre-mainnet checklist".
// ---------------------------------------------------------------------------
const ARC_TESTNET_RPC = process.env.ARC_TESTNET_RPC || "https://rpc.testnet.arc.network";
const ARC_TESTNET_CHAIN_ID = 5042002;

const ARC_MAINNET_RPC = process.env.ARC_MAINNET_RPC || "https://rpc.arc.network"; // VERIFY before use
const ARC_MAINNET_CHAIN_ID = Number(process.env.ARC_MAINNET_CHAIN_ID || 5042); // VERIFY before use

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {},
    arcTestnet: {
      url: ARC_TESTNET_RPC,
      chainId: ARC_TESTNET_CHAIN_ID,
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
    arcMainnet: {
      url: ARC_MAINNET_RPC,
      chainId: ARC_MAINNET_CHAIN_ID,
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
  },
  gasReporter: { enabled: false },
};

export default config;
