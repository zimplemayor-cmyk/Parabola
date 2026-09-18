import { ethers } from "hardhat";

/**
 * Step 1 of 2. Run this from the CURRENT owner wallet (whatever's in
 * DEPLOYER_PRIVATE_KEY right now, the same key deploy.ts used, since the
 * deployer becomes the initial owner automatically).
 *
 * This only *proposes* the transfer, Ownable2Step requires the new owner
 * to separately call acceptOwnership() (see acceptOwnership.ts) before
 * anything actually changes. Until that happens, the current wallet is
 * still fully in control, nothing is lost if step 2 never happens.
 *
 * Usage:
 *   FACTORY_ADDRESS=0x... NEW_OWNER=0x... npx hardhat run scripts/transferOwnership.ts --network arcMainnet
 */
async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const newOwner = process.env.NEW_OWNER;
  if (!factoryAddress) throw new Error("Set FACTORY_ADDRESS in the environment (or .env)");
  if (!newOwner) throw new Error("Set NEW_OWNER in the environment (or .env) to the wallet that should become owner");

  const factory = await ethers.getContractAt("LaunchFactory", factoryAddress);
  const currentOwner = await factory.owner();
  console.log("Current owner:", currentOwner);
  console.log("Proposing new owner:", newOwner);

  const tx = await factory.transferOwnership(newOwner);
  console.log("Tx sent:", tx.hash);
  await tx.wait();

  console.log("Done. Ownership is PENDING, not yet transferred.");
  console.log(`Now run acceptOwnership.ts with ${newOwner}'s private key as DEPLOYER_PRIVATE_KEY to finalize.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
