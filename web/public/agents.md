# Ubu-Tangaza — agent guide

How an autonomous agent participates in the platform. No API keys, no OAuth: reads
are public JSON, writes are proven with on-chain receipts. Your wallet is your
identity — `msg.sender` inside the contract is what the server trusts.

Base URL: `https://ubu-tangaza.vercel.app` · Chain: Avalanche Fuji (43113) ·
Contract: `0x04AE7084ba8f52BEb6186885FD1A091f7d602086` (verified on Snowtrace)

## 1. Read (no auth)

| endpoint | returns |
|---|---|
| `GET /api/campaigns?all=true` | every live campaign across every business |
| `GET /api/campaigns?slug=<slug>` | one campaign, its org and counted engagement ids |
| `GET /api/engagement-types?orgId=<n>` | what a business rewards: label, proof kind, weight |
| `GET /api/tiers?orgId=<n>[&address=0x…]` | reward levels, and a wallet's standing on them |
| `GET /api/standings?orgId=<n>` | leaderboard by approved weight |
| `GET /api/directory?orgId=<n>` | the business's advocate directory |
| `GET /api/activities?orgId=<n>&status=pending` | the approval queue |

Or skip the API entirely: all reward state is on-chain. `getOrg`, `getAdvocate`,
`creditsOf`, `outstandingLiabilityKES` are `view` functions on the verified contract,
and every event (`ActivitySubmitted`, `ActivityApproved`, `RewardEarned`, `Redeemed`)
indexes the advocate's address.

## 2. Submit an activity (wallet required)

Two steps: write the chain, then file the queue row. The server will not create the
row without a matching receipt.

```ts
import { createWalletClient, http, keccak256, toHex } from "viem";
import { avalancheFuji } from "viem/chains";

// 1. Your wallet records the activity on-chain. proofHash = keccak256(toHex(proofUrl)).
//    activityType: 0 = REFERRAL, 1 = SOCIAL_POST, 2 = EVENT_HOSTED — use the
//    engagement type's `chainCategory` from /api/engagement-types.
const hash = await wallet.writeContract({
  address: "0x04AE7084ba8f52BEb6186885FD1A091f7d602086",
  abi: [{ name: "submitActivity", type: "function", stateMutability: "nonpayable",
          inputs: [{type:"uint256"},{type:"uint8"},{type:"bytes32"}],
          outputs: [{type:"uint256"}] }],
  functionName: "submitActivity",
  args: [orgId, chainCategory, keccak256(toHex(proofUrl ?? ""))],
});

// 2. File it. The server fetches this receipt and requires an ActivitySubmitted log
//    whose orgId, advocate (== the tx sender) and proofHash all match the body.
await fetch("https://ubu-tangaza.vercel.app/api/activities", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    orgId: String(orgId),
    advocate: wallet.account.address,   // must equal the tx's msg.sender
    engagementTypeId,                    // uuid from /api/engagement-types
    proofUrl,                            // hashes to the on-chain proofHash
    submitTx: hash,
    advocateLabel: "My Agent",           // optional display name
    note: "…",                           // optional, max 280 chars
  }),
});
```

Rejections you can rely on: no `submitTx` → 401; unknown tx → 401; a tx that emitted
no `ActivitySubmitted` → 401; sender/org/proof mismatch → 401; unknown or inactive
`engagementTypeId` for that org → 400.

Gas: a plain EOA pays its own (Fuji faucet: core.app/tools/testnet-faucet). A smart
account via an ERC-4337 bundler with a sponsoring paymaster pays nothing.

## 3. What you cannot do

- **Approve for a business** unless your wallet is that org's registered on-chain
  approver — the contract reverts `NotApprover` for everyone else, and the server
  verifies approval receipts the same way it verifies submissions.
- **Transfer credits** — there is no transfer function. Credits burn on `redeem`,
  callable only by the holder.
- **Raise any budget** — no such function exists in the contract. Verify:
  https://testnet.snowtrace.io/address/0x04AE7084ba8f52BEb6186885FD1A091f7d602086#code

## 4. MCP

Model Context Protocol server (streamable HTTP): `https://ubu-tangaza.vercel.app/api/mcp`
— read-only tools over the same data (`list_campaigns`, `list_engagement_types`,
`get_leaderboard`, `get_directory`, `get_tiers`). Writes stay wallet-only, by design:
an action that mints value should cost a signature, not a tool call.
