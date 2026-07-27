# Tangaza

**Proof-of-advocacy rewards on Avalanche.** Customers earn real rewards for real
advocacy — referrals, posts on X, events they bring in. A business approves each
activity, and that approval is the on-chain write. The reward budget is capped at
registration, can never be raised, and shrinks as people claim.

Built for the Team1 Kenya Avalanche Game Jam / Mini Hack 2026. Pilot org: the
Blockchain Centre.

---

## The one-sentence version

A customer submits proof off-chain → the business approves it on-chain → every 20
approved activities mints one KES 500 reward credit → the customer claims it for
airtime → the business's outstanding liability drops by KES 500. Nobody in that loop
holds AVAX, sees a seed phrase, or pays gas.

---

## Solvency invariants

These are the point of the project, and they are enforced by the contract, not by the UI.

| # | Invariant | Where it's enforced | Test |
|---|---|---|---|
| 1 | `emissionCapKES` is set once at registration and can never be raised | No function in `TangazaRewards.sol` writes it after `registerOrg` | `INVARIANT: emissionCapKES is immutable` |
| 2 | No credit is minted once issued value would exceed the cap — the activity is still recorded, `BudgetExhausted` is emitted, and **the call does not revert** | `approveActivity` | `INVARIANT: minting halts at the cap without reverting` |
| 3 | `redeem` burns a credit and increases `redeemedKES`, so `outstandingLiabilityKES = issuedKES − redeemedKES` shrinks | `redeem` | `INVARIANT: redeem shrinks outstanding liability` |

A credit only exists because an org approved a real activity. Proof lives off-chain;
the approval is what goes on-chain.

The immutability test asserts the *full list* of state-changing functions, so adding
a new one fails the suite until it's reviewed against invariant 1.

---

## Layout

```
contracts/   Hardhat + TypeScript + Solidity 0.8.24 + OpenZeppelin v5
             TangazaRewards.sol, 32 tests, deploy + seed scripts
web/         Next.js (App Router) + TypeScript + Tailwind v4 + thirdweb v5 + viem
             Customer surface (/), org surface (/org), queue API (/api/activities)
```

---

## Setup

### 0. Prerequisites

- Node 20+ (developed on Node 26)
- A funded Fuji deployer key
- A thirdweb client id with gas sponsorship enabled

### 1. Get Fuji AVAX

Visit the [Core testnet faucet](https://core.app/tools/testnet-faucet/), pick
**Avalanche Fuji C-Chain**, and send test AVAX to the address you'll deploy from.
Only the deployer needs AVAX — advocates and the org never do.

### 2. Get a thirdweb client id

1. Create a project at [thirdweb.com/dashboard](https://thirdweb.com/dashboard).
2. Copy the **Client ID** from Settings → API Keys.
3. Add `http://localhost:3000` to the key's allowed domains.
4. Turn on **Account Abstraction → gas sponsorship** for Avalanche Fuji, so approvals
   and redemptions are paid for by the paymaster rather than the user.

### 3. Contracts

```bash
cd contracts
npm install
cp .env.example .env        # fill in PRIVATE_KEY
npx hardhat test            # 32 passing
```

Rehearse the deploy for free against a local node first, if you like:

```bash
npx hardhat node                                          # terminal 1
npx hardhat run scripts/deploy.ts --network localhost     # terminal 2
npx hardhat run scripts/seed.ts   --network localhost
```

Then deploy for real:

```bash
npx hardhat run scripts/deploy.ts --network fuji
```

The script prints the address, writes `contracts/deployments.json`, and verifies on
Snowtrace when `SNOWTRACE_API_KEY` is set.

### 4. Seed the pilot org

Put the deployed address in `contracts/.env` as `CONTRACT_ADDRESS` (the deploy script
tells you to), then:

```bash
# DEMO_ADVOCATE is optional but recommended — see "Running the demo" below
DEMO_ADVOCATE=0xYourSmartAccountAddress npx hardhat run scripts/seed.ts --network fuji
```

This registers the Blockchain Centre with a KES 50,000 cap and approves activities for
a handful of demo advocates so the leaderboard and liability chart aren't empty.

> Seeding sends one transaction per activity — ~130 on Fuji, a few minutes. Lower the
> `approvals` numbers in `scripts/seed.ts` if you want it faster.

### 5. Web

```bash
cd web
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | from step 2 |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | from step 3 |
| `NEXT_PUBLIC_CHAIN` | `fuji` |
| `NEXT_PUBLIC_ORG_ID` | `1` |
| `NEXT_PUBLIC_DEPLOY_BLOCK` | `blockNumber` from `contracts/deployments.json` — event scanning starts here |
| `NEXT_PUBLIC_ORG_APPROVER` | the approver's smart-account address; blank = any signed-in account (dev only) |

```bash
npm run dev     # http://localhost:3000
```

If you change the contract, re-sync the ABI: `cd contracts && npx hardhat compile`
then `cd ../web && npm run sync:abi`.

---

## Running the demo

The judging story is one unbroken earn → redeem journey.

1. **Sign in as a customer** at `/`. Google or X. No seed phrase appears, because the
   in-app wallet is an embedded key wrapped in an ERC-4337 smart account.
2. **Submit an activity** at `/submit` — pick a type, paste a proof link. This is
   off-chain; it lands in the queue via `POST /api/activities`.
3. **Sign in as the org** at `/org` (a second browser profile is easiest). The
   submission is in the approvals queue with its proof link.
4. **Approve it.** That calls `approveActivity()` on Fuji, gaslessly. The customer's
   activity count and streak update on-chain.
5. **Cross 20 activities** and one KES 500 credit mints. Seed `DEMO_ADVOCATE` to your
   customer smart-account address so it sits at 19 — then a single approval on stage
   mints the credit live.
6. **Claim it** at `/rewards` → pick airtime → a real transaction hash appears, linked
   to Snowtrace.
7. **Watch the liability drop** at `/org/liability`. Outstanding = committed − settled,
   and it just fell by KES 500.

To demo the cap: register a second org with a tiny `emissionCapKES` and approve past
it. Activities keep recording, `BudgetExhausted` fires, no credit mints, nothing reverts.

---

## Architecture notes

**Why the trusted forwarder is `address(0)`.** Gasless UX here comes from ERC-4337
smart accounts, not an ERC-2771 relayer. With a smart account, `msg.sender` *is* the
user's account. `ERC2771Context` falls back to the real `msg.sender` when no forwarder
is trusted, so passing zero is correct — passing a real forwarder would be wrong.

**Why the queue is off-chain.** Proof URLs, notes and rejected submissions have no
business on a public chain. Only the approval and the redemption are written. The
queue is a JSON file (`web/data/activities.json`) — no native dependencies, no
migrations, and `cat` is a valid debugging tool. Every caller goes through
`web/lib/store.ts`, so swapping in SQLite or Postgres touches one file.

**Why there's no indexer.** `web/lib/events.ts` polls `getContractEvents` in
2000-block windows and folds the results in the browser. That's ample for one pilot
org and keeps the stack to two packages. It is the first thing to replace at scale.

**Why `viaIR` is on.** The contract hits "stack too deep" without the IR pipeline.
Optimizer runs: 200.

**The liability chart** is an emphasis chart, not a two-axis chart: outstanding
liability carries the accent hue because it's the story, committed-to-date is gray
context, and the cap is a dashed threshold. The palette validates on the dark surface
at CVD ΔE 9.5 / normal-vision ΔE 22.7, both marks above 3:1 contrast. It ships with a
crosshair tooltip, keyboard navigation, and a table view so no value is hover-gated.

---

## Scope

Built: the Blockchain Centre pilot, end to end. The X-content case is the same rails
with a different `ActivityType` — deliberately not a second app.

Closed-loop only. Credits are non-transferable records inside the contract, not a
tradeable token: there is no `transfer`, no allowance, no market.
