import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { TangazaRewards } from "../typechain-types";

/**
 * Seeds the Blockchain Centre pilot so the demo has history on day one:
 *   - registers the org with a fixed, never-raisable emission cap
 *   - approves activities for a few demo advocates so the leaderboard is populated
 *   - optionally parks DEMO_ADVOCATE one approval short of a credit, so the live
 *     demo can do "approve -> milestone -> credit" in a single click
 *
 * Set DEMO_ADVOCATE in contracts/.env to your thirdweb smart-account address to make
 * the on-stage journey land on the account you're actually signed in as.
 */

const ORG_NAME = process.env.ORG_NAME ?? "Blockchain Centre Kenya";
const ORG_EMISSION_CAP_KES = BigInt(process.env.ORG_EMISSION_CAP_KES ?? "50000");

/**
 * Scales the whole demo roster. Every approval is its own transaction, so on a
 * thinly-funded testnet key this is the dial between "rich leaderboard" and
 * "affordable". 1 = the full roster below; 0.5 = half the approvals each.
 */
const SEED_SCALE = Number(process.env.SEED_SCALE ?? "1");

/** Activities per transaction. 40 keeps each batch well under the block gas limit. */
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? "40");

const ActivityType = { REFERRAL: 0, SOCIAL_POST: 1, EVENT_HOSTED: 2 } as const;

// Deterministic throwaway addresses purely so the leaderboard has other names on it.
// Counts are chosen so the leaderboard has a clear winner and a mix of
// credit-earning and still-climbing advocates.
const DEMO_ADVOCATES: Array<{ label: string; address: string; approvals: number }> = [
  { label: "Wanjiru", address: "0x1111111111111111111111111111111111111111", approvals: 43 },
  { label: "Otieno", address: "0x2222222222222222222222222222222222222222", approvals: 27 },
  { label: "Achieng", address: "0x3333333333333333333333333333333333333333", approvals: 21 },
  { label: "Kamau", address: "0x4444444444444444444444444444444444444444", approvals: 12 },
  { label: "Njeri", address: "0x5555555555555555555555555555555555555555", approvals: 6 },
];

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

const proof = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

async function main() {
  const [signer] = await ethers.getSigners();
  const address = resolveAddress();
  const rewards = (await ethers.getContractAt(
    "TangazaRewards",
    address,
    signer
  )) as unknown as TangazaRewards;

  console.log(`Contract: ${address}`);
  console.log(`Signer:   ${signer.address}\n`);

  const approver = process.env.ORG_APPROVER || signer.address;

  // Reuse org 1 if it already exists so seeding is safe to re-run.
  let orgId: bigint;
  const existing = await rewards.orgCount();
  if (existing > 0n) {
    orgId = 1n;
    const org = await rewards.getOrg(orgId);
    console.log(`Reusing org #${orgId}: ${org.name} (cap ${org.emissionCapKES} KES)`);
  } else {
    const tx = await rewards.registerOrg(ORG_NAME, approver, ORG_EMISSION_CAP_KES);
    await tx.wait();
    orgId = 1n;
    console.log(
      `Registered org #${orgId}: ${ORG_NAME}, approver ${approver}, cap ${ORG_EMISSION_CAP_KES} KES`
    );
    console.log(`  tx ${tx.hash}`);
  }

  const roster = DEMO_ADVOCATES.map((a) => ({
    ...a,
    approvals: Math.max(1, Math.round(a.approvals * SEED_SCALE)),
  }));
  if (process.env.DEMO_ADVOCATE) {
    // One short of the 20-activity milestone: the live demo's single approval mints.
    // Never scaled — landing exactly on 19 is the whole point.
    roster.push({
      label: "DEMO_ADVOCATE (you)",
      address: process.env.DEMO_ADVOCATE,
      approvals: 19,
    });
  }

  // Every approval is a transaction. Price the whole run before spending anything,
  // so this fails with a number you can act on rather than dying mid-roster.
  const planned: number[] = [];
  for (const advocate of roster) {
    const before = await rewards.getAdvocate(orgId, advocate.address);
    planned.push(Math.max(0, advocate.approvals - Number(before.approvedActivities)));
  }
  const txCount = planned.reduce((a, b) => a + b, 0);

  if (txCount > 0) {
    const sample = roster.find((_, i) => planned[i] > 0)!;
    const probe = Math.min(BATCH_SIZE, planned.find((n) => n > 0)!);

    // Estimate a real batch, not a single cold approval — the earlier version
    // extrapolated the cold-start cost across every activity and over-projected ~3x.
    const gasPerBatch = await rewards.approveActivityBatch.estimateGas(
      orgId,
      Array(probe).fill(sample.address),
      Array(probe).fill(ActivityType.REFERRAL),
      Array.from({ length: probe }, (_, i) => proof(`estimate${i}`))
    );

    const fee = await ethers.provider.getFeeData();
    const gasPrice = fee.gasPrice ?? 0n;
    // 20% headroom: milestone entries mint a credit and cost more than plain ones.
    const projected =
      (gasPerBatch * gasPrice * BigInt(txCount) * 120n) / (BigInt(probe) * 100n);
    const balance = await ethers.provider.getBalance(signer.address);

    const batches = Math.ceil(txCount / BATCH_SIZE);
    console.log(`\nPlanned: ${txCount} approvals in ${batches} batched transaction(s)`);
    console.log(`  ~${ethers.formatEther(projected)} AVAX projected (incl. 20% headroom)`);
    console.log(`  ${ethers.formatEther(balance)} AVAX available`);

    if (projected > balance) {
      const affordable = (Number(balance) / Number(projected)) * SEED_SCALE * 0.9;
      throw new Error(
        `Not enough AVAX for ${txCount} approvals.\n` +
          `  Either fund ${signer.address} with more Fuji AVAX,\n` +
          `  or re-run with a smaller roster: SEED_SCALE=${affordable.toFixed(2)}`
      );
    }
  }

  for (const advocate of roster) {
    const before = await rewards.getAdvocate(orgId, advocate.address);
    const todo = advocate.approvals - Number(before.approvedActivities);
    if (todo <= 0) {
      console.log(`\n${advocate.label}: already at ${before.approvedActivities}, skipping`);
      continue;
    }

    console.log(`\n${advocate.label} (${advocate.address}): approving ${todo} activities`);

    // One transaction per BATCH_SIZE activities instead of one per activity.
    for (let start = 0; start < todo; start += BATCH_SIZE) {
      const size = Math.min(BATCH_SIZE, todo - start);
      const types: number[] = [];
      const proofs: string[] = [];

      for (let i = start; i < start + size; i++) {
        types.push(
          i % 3 === 0
            ? ActivityType.REFERRAL
            : i % 3 === 1
              ? ActivityType.SOCIAL_POST
              : ActivityType.EVENT_HOSTED
        );
        proofs.push(proof(`seed:${advocate.label}:${i}`));
      }

      const tx = await rewards.approveActivityBatch(
        orgId,
        Array(size).fill(advocate.address),
        types,
        proofs
      );
      await tx.wait();
      process.stdout.write(`[${size}]`);
    }
    const after = await rewards.getAdvocate(orgId, advocate.address);
    console.log(
      `\n  -> ${after.approvedActivities} activities, ${after.creditsEarned} credits, streak ${after.streak}`
    );
  }

  const org = await rewards.getOrg(orgId);
  const outstanding = await rewards.outstandingLiabilityKES(orgId);
  console.log("\n--- Org #1 after seeding ---");
  console.log(`Cap:         ${org.emissionCapKES} KES  (immutable)`);
  console.log(`Issued:      ${org.issuedKES} KES`);
  console.log(`Redeemed:    ${org.redeemedKES} KES`);
  console.log(`Outstanding: ${outstanding} KES`);
  console.log(`Credits:     ${await rewards.creditCount()}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
