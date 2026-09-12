import { ethers, network } from "hardhat";

/**
 * Deploys LaunchFactory to whichever network Hardhat was pointed at
 * (`npm run deploy:testnet` / `npm run deploy:mainnet`, see package.json and
 * hardhat.config.ts). Does NOT set dexRouter/dexFactory — those addresses
 * are not public until Arc's DEX ecosystem confirms them post-mainnet-launch.
 * Run setDexConfig() from the owner account once you have them; see
 * SECURITY.md → "Before mainnet with real funds" for the full checklist.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  if (!process.env.TREASURY_ADDRESS) {
    console.warn(
      "⚠ TREASURY_ADDRESS not set in .env — defaulting to the deployer address. " +
        "Set a real (ideally multisig) treasury before taking real fees."
    );
  }

  const Factory = await ethers.getContractFactory("LaunchFactory");
  const factory = await Factory.deploy(deployer.address, treasury);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log(`\nLaunchFactory deployed: ${factoryAddress}`);
  console.log(`Owner:                  ${deployer.address}`);
  console.log(`Treasury:               ${treasury}`);
  console.log(
    "\nNext steps:\n" +
      "  1. Copy this address into NEXT_PUBLIC_FACTORY_ADDRESS in the frontend's .env\n" +
      "  2. Once Arc's live DEX router/factory addresses are confirmed, call\n" +
      "     factory.setDexConfig(router, dexFactory) from the owner account\n" +
      "  3. Transfer ownership to a multisig before any real volume — see SECURITY.md\n"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
