import { ethers } from "hardhat";
import { TangazaRewards } from "../typechain-types";

/**
 * Measures the gas that actually matters for running Ubu-Tangaza:
 * a plain approval, a milestone approval (which also mints a credit), and a redeem.
 *
 *   npx hardhat run scripts/gas.ts
 */

const proof = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

async function main() {
  const [owner, approver, advocate] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("TangazaRewards");
  const rewards = (await Factory.deploy(ethers.ZeroAddress)) as unknown as TangazaRewards;
  await rewards.waitForDeployment();
  await rewards.registerOrg("Blockchain Centre Kenya", approver.address, 50_000);

  const used = async (p: Promise<{ wait: () => Promise<{ gasUsed: bigint } | null> }>) => {
    const receipt = await (await p).wait();
    return receipt!.gasUsed;
  };

  // First approval for an advocate: cold storage, worst case.
  const first = await used(
    rewards.connect(approver).approveActivity(1n, advocate.address, 0, proof("1")) as never
  );

  // Steady state: warm slots, no credit minted.
  let warm = 0n;
  for (let i = 2; i <= 19; i++) {
    warm = await used(
      rewards.connect(approver).approveActivity(1n, advocate.address, 0, proof(`${i}`)) as never
    );
  }

  // The 20th also mints a Credit.
  const milestone = await used(
    rewards.connect(approver).approveActivity(1n, advocate.address, 0, proof("20")) as never
  );

  const redeem = await used(rewards.connect(advocate).redeem(1n, 0) as never);

  // Batch of 20 for a fresh advocate: 19 plain + 1 milestone, one transaction.
  const batchAdvocate = ethers.Wallet.createRandom().address;
  const batchGas = await used(
    rewards
      .connect(approver)
      .approveActivityBatch(
        1n,
        Array(20).fill(batchAdvocate),
        Array(20).fill(0),
        Array.from({ length: 20 }, (_, i) => proof(`b${i}`))
      ) as never
  );

  const rows = {
    "approveActivity (first, cold)": first,
    "approveActivity (steady state)": warm,
    "approveActivity (milestone + mint)": milestone,
    "redeem": redeem,
    "approveActivityBatch(20) total": batchGas,
    "  -> per activity": batchGas / 20n,
  };

  console.log("\nGas used");
  for (const [label, gas] of Object.entries(rows)) {
    console.log(`  ${label.padEnd(36)} ${gas.toString().padStart(8)}`);
  }

  // What a 109-approval seed run costs at Fuji's current base fee.
  const GWEI = 11n;
  const avax = (gas: bigint) => ethers.formatEther(gas * GWEI * 10n ** 9n);

  const oneByOne = first * 6n + warm * 98n + milestone * 5n;
  const batched = (batchGas / 20n) * 109n;

  console.log(`\n109-approval seed run at ${GWEI} gwei`);
  console.log(`  one tx per approval: ${oneByOne} gas = ${avax(oneByOne)} AVAX`);
  console.log(`  batched:             ${batched} gas = ${avax(batched)} AVAX`);
  console.log(
    `  saving:              ${(100n - (batched * 100n) / oneByOne).toString()}%`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
