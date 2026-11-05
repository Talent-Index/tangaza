import { ethers, network } from "hardhat";

/**
 * Read-only pre-flight for a deploy: which address PRIVATE_KEY resolves to, on which
 * chain, with what balance. Sends nothing. Run this before deploy.ts on mainnet —
 * deploy.ts spends the moment it starts, so this is the only place to catch a wrong
 * key or an unfunded account first.
 *
 *   npx hardhat run scripts/whoami.ts --network avalanche
 */
async function main() {
  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer — set PRIVATE_KEY in contracts/.env");
  const [balance, net] = await Promise.all([
    ethers.provider.getBalance(signer.address),
    ethers.provider.getNetwork(),
  ]);
  console.log(`Network:  ${network.name} (chainId ${net.chainId})`);
  console.log(`Deployer: ${signer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} AVAX`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
