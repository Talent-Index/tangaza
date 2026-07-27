// Copies the compiled TangazaRewards ABI into web/lib/abi.ts.
// Run from web/: npm run sync:abi   (after `npx hardhat compile` in contracts/)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artifact = join(
  here,
  "..",
  "..",
  "contracts",
  "artifacts",
  "contracts",
  "TangazaRewards.sol",
  "TangazaRewards.json"
);

if (!existsSync(artifact)) {
  console.error(`No artifact at ${artifact}\nRun: cd ../contracts && npx hardhat compile`);
  process.exit(1);
}

const { abi } = JSON.parse(readFileSync(artifact, "utf8"));
const out = join(here, "..", "lib", "abi.ts");
writeFileSync(
  out,
  `// Generated from contracts/artifacts/contracts/TangazaRewards.sol/TangazaRewards.json\n` +
    `// Regenerate with: npm run sync:abi (from web/)\n\n` +
    `export const TANGAZA_ABI = ${JSON.stringify(abi, null, 2)} as const;\n`
);
console.log(`Wrote ${out} (${abi.length} entries)`);
