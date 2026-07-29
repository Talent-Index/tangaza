import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { TangazaRewards } from "../typechain-types";

/**
 * Registers a business on-chain from a signed application.
 *
 * registerOrg is onlyOwner on purpose — registering an org mints the right to issue
 * reward liabilities against a cap nobody can later raise, so it stays with the
 * platform. A business applies at /register, signs its pledge, and the operator runs:
 *
 *   ORG_NAME="FitTribe" ORG_APPROVER=0x… ORG_CAP_KES=5000 \
 *     npx hardhat run scripts/register-org.ts --network fuji
 *
 * Prints the orgId to record against the application.
 */

function resolveAddress(): string {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;
  const file = path.join(__dirname, "..", "deployments.json");
  if (fs.existsSync(file)) {
    const all = JSON.parse(fs.readFileSync(file, "utf8"));
    if (all[network.name]?.address) return all[network.name].address;
  }
  throw new Error("No contract address configured.");
}

async function main() {
  const name = process.env.ORG_NAME;
  const approver = process.env.ORG_APPROVER;
  const cap = BigInt(process.env.ORG_CAP_KES ?? "0");

  if (!name || !approver || !ethers.isAddress(approver) || cap <= 0n) {
    throw new Error(
      "Usage: ORG_NAME=… ORG_APPROVER=0x… ORG_CAP_KES=… npx hardhat run scripts/register-org.ts --network fuji"
    );
  }

  const [signer] = await ethers.getSigners();
  const rewards = (await ethers.getContractAt(
    "TangazaRewards",
    resolveAddress(),
    signer
  )) as unknown as TangazaRewards;

  const tx = await rewards.registerOrg(name, approver, cap, { gasLimit: 400_000 });
  const receipt = await tx.wait();
  const orgId = await rewards.orgCount();

  console.log(`Registered org #${orgId}: ${name}`);
  console.log(`  approver ${approver}`);
  console.log(`  cap      ${cap} KES (immutable)`);
  console.log(`  tx       ${receipt?.hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
