/**
 * Exercises the browser's exact read path from the command line: real thirdweb
 * client, real ABI, real Fuji. Catches client-id problems, ABI drift and struct
 * decoding bugs without needing a browser or a wallet.
 *
 *   cd web && node --env-file=.env.local scripts/verify-reads.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createThirdwebClient, getContract, readContract, getContractEvents, prepareEvent } from "thirdweb";
import { avalancheFuji } from "thirdweb/chains";
import { eth_blockNumber, getRpcClient } from "thirdweb/rpc";

const here = dirname(fileURLToPath(import.meta.url));
const { abi } = JSON.parse(
  readFileSync(
    join(here, "..", "..", "contracts", "artifacts", "contracts", "TangazaRewards.sol", "TangazaRewards.json"),
    "utf8"
  )
);

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const orgId = BigInt(process.env.NEXT_PUBLIC_ORG_ID ?? "1");
const deployBlock = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? "0");

if (!clientId || !address) {
  console.error("Missing NEXT_PUBLIC_THIRDWEB_CLIENT_ID or NEXT_PUBLIC_CONTRACT_ADDRESS");
  process.exit(1);
}

const client = createThirdwebClient({ clientId });
const contract = getContract({ client, chain: avalancheFuji, address, abi });

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

console.log(`Contract ${address} on Fuji\n`);

// --- constants -------------------------------------------------------------
console.log("Constants");
const creditValue = await readContract({ contract, method: "CREDIT_VALUE_KES" });
const milestone = await readContract({ contract, method: "MILESTONE_ACTIVITIES" });
check("CREDIT_VALUE_KES is 500", creditValue === 500n, String(creditValue));
check("MILESTONE_ACTIVITIES is 20", milestone === 20n, String(milestone));

// --- org struct ------------------------------------------------------------
console.log("\nOrg struct");
const org = await readContract({ contract, method: "getOrg", params: [orgId] });
check("name decodes", typeof org.name === "string" && org.name.length > 0, org.name);
check("cap is 50000", org.emissionCapKES === 50000n, String(org.emissionCapKES));
check("issued is 2000", org.issuedKES === 2000n, String(org.issuedKES));
check("active", org.active === true);

const outstanding = await readContract({
  contract,
  method: "outstandingLiabilityKES",
  params: [orgId],
});
check(
  "outstanding equals issued - redeemed",
  outstanding === org.issuedKES - org.redeemedKES,
  `${outstanding}`
);

// --- advocate struct (packed) ---------------------------------------------
console.log("\nAdvocate struct (packed uint64/uint32)");
const WANJIRU = "0x1111111111111111111111111111111111111111";
const adv = await readContract({ contract, method: "getAdvocate", params: [orgId, WANJIRU] });
check("approvedActivities is 43", Number(adv.approvedActivities) === 43, String(adv.approvedActivities));
check("creditsEarned is 2", Number(adv.creditsEarned) === 2, String(adv.creditsEarned));
check("streak decodes", Number(adv.streak) >= 1, String(adv.streak));
console.log(
  `        widths: approvedActivities=${typeof adv.approvedActivities}, streak=${typeof adv.streak}`
);

const toNext = await readContract({
  contract,
  method: "activitiesToNextCredit",
  params: [orgId, WANJIRU],
});
check("activitiesToNextCredit is 17 (43 % 20 = 3)", Number(toNext) === 17, String(toNext));

// --- credit struct (packed) -----------------------------------------------
console.log("\nCredit struct (packed)");
const ids = await readContract({ contract, method: "creditsOf", params: [WANJIRU] });
check("creditsOf returns 2 ids", ids.length === 2, `[${ids.join(", ")}]`);

const credit = await readContract({ contract, method: "getCredit", params: [ids[0]] });
check("holder matches", credit.holder.toLowerCase() === WANJIRU.toLowerCase(), credit.holder);
check("valueKES is 500", Number(credit.valueKES) === 500, String(credit.valueKES));
check("orgId is 1", Number(credit.orgId) === 1, String(credit.orgId));
check("not redeemed", credit.redeemed === false);
check("earnedAt is a real timestamp", Number(credit.earnedAt) > 1_700_000_000, String(credit.earnedAt));
console.log(
  `        widths: valueKES=${typeof credit.valueKES}, earnedAt=${typeof credit.earnedAt}`
);

// --- events (the dashboards' data source) ---------------------------------
console.log("\nEvent indexing");
const events = {
  RewardEarned: prepareEvent({
    signature:
      "event RewardEarned(uint256 indexed orgId, address indexed advocate, uint256 indexed creditId, uint256 valueKES, uint256 issuedKES, uint256 timestamp)",
  }),
  Redeemed: prepareEvent({
    signature:
      "event Redeemed(uint256 indexed orgId, address indexed advocate, uint256 indexed creditId, uint8 rewardType, uint256 valueKES, uint256 redeemedKES, uint256 timestamp)",
  }),
  ActivityApproved: prepareEvent({
    signature:
      "event ActivityApproved(uint256 indexed orgId, address indexed advocate, uint8 activityType, bytes32 proofHash, uint256 advocateActivityCount, uint256 streak, uint256 timestamp)",
  }),
};

const rpc = getRpcClient({ client, chain: avalancheFuji });
const latest = await eth_blockNumber(rpc);
const WINDOW = 2000n;
const logs = [];
for (let from = deployBlock; from <= latest; from += WINDOW) {
  const to = from + WINDOW - 1n > latest ? latest : from + WINDOW - 1n;
  logs.push(...(await getContractEvents({ contract, events: Object.values(events), fromBlock: from, toBlock: to })));
}

const byName = (n) => logs.filter((l) => l.eventName === n);
check("109 ActivityApproved events", byName("ActivityApproved").length === 109, String(byName("ActivityApproved").length));
check("4 RewardEarned events", byName("RewardEarned").length === 4, String(byName("RewardEarned").length));

const issuedFromEvents = byName("RewardEarned").reduce((sum, l) => sum + l.args.valueKES, 0n);
check("events reconstruct issuedKES", issuedFromEvents === org.issuedKES, `${issuedFromEvents} vs ${org.issuedKES}`);

const leaders = new Map();
for (const l of byName("ActivityApproved")) {
  leaders.set(l.args.advocate.toLowerCase(), Number(l.args.advocateActivityCount));
}
check("leaderboard folds to 5 advocates", leaders.size === 5, `${leaders.size}`);
check("top advocate has 43", Math.max(...leaders.values()) === 43, String(Math.max(...leaders.values())));

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
