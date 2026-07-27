import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { TangazaRewards } from "../typechain-types";

/**
 * Prints everything you need to know about a live deployment: deployer balance,
 * the block to start event-scanning from, and each org's solvency position.
 *
 *   npx hardhat run scripts/status.ts --network fuji
 *
 * Also backfills `blockNumber` in deployments.json if an older deploy left it null.
 */

function deploymentFile() {
  return path.join(__dirname, "..", "deployments.json");
}

function loadDeployment() {
  const file = deploymentFile();
  if (!fs.existsSync(file)) throw new Error(`No ${file} — run scripts/deploy.ts first.`);
  const all = JSON.parse(fs.readFileSync(file, "utf8"));
  const record = all[network.name];
  if (!record) throw new Error(`No deployment recorded for network "${network.name}".`);
  return { all, record, file };
}

async function main() {
  const { all, record, file } = loadDeployment();
  const [signer] = await ethers.getSigners();

  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`Network:   ${network.name}`);
  console.log(`Contract:  ${record.address}`);
  console.log(`Deployer:  ${signer.address}`);
  console.log(`Balance:   ${ethers.formatEther(balance)} AVAX`);

  // Backfill the deploy block if it wasn't captured at deploy time.
  let deployBlock = record.blockNumber;
  if (!deployBlock && record.deploymentTx) {
    const receipt = await ethers.provider.getTransactionReceipt(record.deploymentTx);
    deployBlock = receipt?.blockNumber ?? null;
    if (deployBlock) {
      all[network.name].blockNumber = deployBlock;
      fs.writeFileSync(file, JSON.stringify(all, null, 2) + "\n");
      console.log(`(backfilled blockNumber into deployments.json)`);
    }
  }
  console.log(`Deployed in block: ${deployBlock ?? "unknown"}`);
  console.log(`  -> web/.env.local: NEXT_PUBLIC_DEPLOY_BLOCK=${deployBlock ?? 0}`);

  const fee = await ethers.provider.getFeeData();
  const gwei = ethers.formatUnits(fee.gasPrice ?? 0n, "gwei");
  console.log(`Gas price: ${gwei} gwei`);

  const rewards = (await ethers.getContractAt(
    "TangazaRewards",
    record.address,
    signer
  )) as unknown as TangazaRewards;

  const orgCount = await rewards.orgCount();
  const creditCount = await rewards.creditCount();
  console.log(`\nOrgs: ${orgCount} · Credits minted: ${creditCount}`);

  for (let id = 1n; id <= orgCount; id++) {
    const org = await rewards.getOrg(id);
    const outstanding = await rewards.outstandingLiabilityKES(id);
    const remaining = await rewards.remainingBudgetKES(id);
    console.log(`\n  Org #${id}: ${org.name}`);
    console.log(`    approver:    ${org.approver}`);
    console.log(`    active:      ${org.active}`);
    console.log(`    cap:         ${org.emissionCapKES} KES (immutable)`);
    console.log(`    issued:      ${org.issuedKES} KES`);
    console.log(`    redeemed:    ${org.redeemedKES} KES`);
    console.log(`    outstanding: ${outstanding} KES`);
    console.log(`    headroom:    ${remaining} KES`);
    console.log(`    activities:  ${org.approvedActivities}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
