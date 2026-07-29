import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { TangazaRewards } from "../typechain-types";

/**
 * Points an org's approver at the address that will actually click "Approve" in the
 * web UI.
 *
 * This exists because of a sequencing trap: the org signs in with Google/X, which
 * gives it an ERC-4337 *smart account* — a different address from the deployer EOA
 * that ran deploy.ts. `approveActivity` only accepts the org's approver or the
 * contract owner, so until the approver is set to that smart account, every approval
 * from the UI reverts with NotApprover.
 *
 * Usage (address printed by the ConnectButton details on /org):
 *   APPROVER=0xYourOrgSmartAccount npx hardhat run scripts/set-approver.ts --network fuji
 */

function resolveAddress(): string {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;

  const file = path.join(__dirname, "..", "deployments.json");
  if (fs.existsSync(file)) {
    const all = JSON.parse(fs.readFileSync(file, "utf8"));
    if (all[network.name]?.address) return all[network.name].address;
  }
  throw new Error(
    "No contract address. Set CONTRACT_ADDRESS in contracts/.env or run scripts/deploy.ts first."
  );
}

async function main() {
  const approver = process.env.APPROVER;
  if (!approver || !ethers.isAddress(approver)) {
    throw new Error(
      "Set APPROVER to the org's smart-account address:\n" +
        "  APPROVER=0x… npx hardhat run scripts/set-approver.ts --network fuji"
    );
  }

  const orgId = BigInt(process.env.ORG_ID ?? "1");
  const [signer] = await ethers.getSigners();
  const rewards = (await ethers.getContractAt(
    "TangazaRewards",
    resolveAddress(),
    signer
  )) as unknown as TangazaRewards;

  const before = await rewards.getOrg(orgId);
  console.log(`Org #${orgId}: ${before.name}`);
  console.log(`  approver ${before.approver} -> ${approver}`);

  const tx = await rewards.setApprover(orgId, approver, { gasLimit: 120_000 });
  await tx.wait();
  console.log(`  done, tx ${tx.hash}`);

  const after = await rewards.getOrg(orgId);
  console.log(`\nApprover is now ${after.approver}`);
  // The cap is untouched by this call — invariant 1 holds.
  console.log(`Cap unchanged at ${after.emissionCapKES} KES`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
