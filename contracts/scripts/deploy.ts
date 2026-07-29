import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys TangazaRewards with a ZERO trusted forwarder.
 *
 * Why zero: gasless UX comes from ERC-4337 smart accounts (thirdweb account
 * abstraction), not from an ERC-2771 relayer. With a smart account, msg.sender IS
 * the user's account, and ERC2771Context falls back to msg.sender when no forwarder
 * is trusted. Passing a real forwarder here would be wrong for that setup.
 */
const TRUSTED_FORWARDER = "0x0000000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No signer available. Set PRIVATE_KEY in contracts/.env before deploying."
    );
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network:  ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} AVAX`);

  if (balance === 0n && network.name !== "hardhat") {
    throw new Error(
      "Deployer has 0 AVAX. Fund it at https://core.app/tools/testnet-faucet/ (Fuji C-Chain)."
    );
  }

  const Factory = await ethers.getContractFactory("TangazaRewards");
  // Explicit gasLimit because Fuji's RPC no longer serves eth_estimateGas against the
  // "pending" tag, which is what hardhat-ethers defaults to — estimation dies with
  // "state not available for pending block". You pay gas used, not the limit, and the
  // deployment actually uses ~1.4M.
  const rewards = await Factory.deploy(TRUSTED_FORWARDER, { gasLimit: 4_000_000 });
  console.log(`\nDeploying... tx ${rewards.deploymentTransaction()?.hash}`);
  await rewards.waitForDeployment();

  const address = await rewards.getAddress();
  // The deployment tx object has no blockNumber until it is mined — the receipt does,
  // and web/.env.local needs it for NEXT_PUBLIC_DEPLOY_BLOCK.
  const receipt = await rewards.deploymentTransaction()?.wait();
  console.log(`\n✅ TangazaRewards deployed to ${address}`);
  if (network.name === "fuji") {
    console.log(`   https://testnet.snowtrace.io/address/${address}`);
  }

  const record = {
    network: network.name,
    chainId: Number(network.config.chainId),
    address,
    trustedForwarder: TRUSTED_FORWARDER,
    owner: deployer.address,
    deploymentTx: rewards.deploymentTransaction()?.hash ?? null,
    blockNumber: receipt?.blockNumber ?? null,
  };
  const out = path.join(__dirname, "..", "deployments.json");
  const all = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};
  all[network.name] = record;
  fs.writeFileSync(out, JSON.stringify(all, null, 2) + "\n");
  console.log(`   Wrote ${out}`);

  console.log("\nNext:");
  console.log(`  1. contracts/.env   -> CONTRACT_ADDRESS=${address}`);
  console.log(`  2. web/.env.local   -> NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(`                      -> NEXT_PUBLIC_DEPLOY_BLOCK=${receipt?.blockNumber ?? 0}`);
  console.log(`  3. npx hardhat run scripts/seed.ts --network ${network.name}`);

  // Verification needs a few confirmations before the explorer indexes the code.
  if (network.name === "fuji" && process.env.SNOWTRACE_API_KEY) {
    console.log("\nWaiting 5 confirmations before verifying...");
    await rewards.deploymentTransaction()?.wait(5);
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [TRUSTED_FORWARDER],
      });
    } catch (err) {
      console.warn(`Verification skipped: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
