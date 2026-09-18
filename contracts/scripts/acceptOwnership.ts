import { ethers } from "hardhat";

/**
 * Step 2 of 2. Run this from the NEW owner wallet, the one you proposed in
 * transferOwnership.ts's NEW_OWNER. Swap DEPLOYER_PRIVATE_KEY in .env to
 * that wallet's private key before running this (it's just the signer for
 * this one script, it does not need to be anything used elsewhere,
 * ideally it's a wallet you set up specifically to be "owner-only" and
 * rarely touch again).
 *
 * Usage:
 *   FACTORY_ADDRESS=0x... npx hardhat run scripts/acceptOwnership.ts --network arcMainnet
 */
async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS;
  if (!factoryAddress) throw new Error("Set FACTORY_ADDRESS in the environment (or .env)");

  const factory = await ethers.getContractAt("LaunchFactory", factoryAddress);
  const pending = await factory.pendingOwner();
  const [signer] = await ethers.getSigners();

  if (pending.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `The wallet signing this (${signer.address}) doesn't match the pending owner (${pending}). ` +
        `Check DEPLOYER_PRIVATE_KEY is set to the NEW owner's key, not the old one.`
    );
  }

  const tx = await factory.acceptOwnership();
  console.log("Tx sent:", tx.hash);
  await tx.wait();

  const confirmedOwner = await factory.owner();
  console.log("Ownership transfer complete. New owner:", confirmedOwner);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
