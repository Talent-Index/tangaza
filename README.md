# Ubu-Tangaza

> **ubu** — from *ubuntu*, the southern African idea that a person is a person
> through other people. **tangaza** — Swahili, *to announce, to proclaim*.
> Together: what you say for your community, and what your community gives back.

**Grow your business through trackable referrals.** Your customers already bring you
clients, refer their friends and talk you up — Ubu-Tangaza lets you see exactly who,
back every action with proof, and reward them however you choose: cash, airtime, a
voucher, a discount, free product. You set what counts, what it's worth, and the levels
people climb.

Under the hood the trust is on-chain and invisible: a business registers with a reward
budget written once — no function can raise it — and every approved action is attested
by the business's own wallet. Customers can't be quietly stiffed, costs can't run past
the budget even if you go viral, and nobody has to take a dashboard's word for it.
Advocates sign in with Google and never see a wallet.

The name is the thesis: **ubu** (*ubuntu* — a person is a person through other people)
and **tangaza** (*to announce*). Growth is something a business and its community do
together, from a budget everyone can audit.

Born at the Team1 Kenya Avalanche Game Jam / Mini Hack 2026; now focused on retail &
SME loyalty — the coffee shops, salons and boutiques that live on referrals.

---

## Deployed

**Live at [ubutangaza.biz](https://ubutangaza.biz)** — advocate surface at
`/`, business surface at `/org`.

**Avalanche Fuji**, chain id `43113`. The only network this is deployed to.

| | |
|---|---|
| `TangazaRewards` | [`0xECa2c9067355410EdFc1622246c64d6F1b29038E`](https://testnet.snowtrace.io/address/0xECa2c9067355410EdFc1622246c64d6F1b29038E) |
| Deploy block | `57436704` — this is `NEXT_PUBLIC_DEPLOY_BLOCK`; event scanning starts here |
| Owner | [`0x2B15bb3C65Cbd5E64Bd80F3DB5BfE085FA87dDD7`](https://testnet.snowtrace.io/address/0x2B15bb3C65Cbd5E64Bd80F3DB5BfE085FA87dDD7) |
| Trusted forwarder | `0x0000000000000000000000000000000000000000` — deliberate, see [Architecture notes](#architecture-notes) |
| Pilot org | `orgId` `1` — "Blockchain Centre Kenya", KES 50,000 cap |
| Second org | `orgId` `2` — "FitTribe", KES 5,000 cap, with the "Founding 20" campaign at [`/c/founding-members`](https://ubutangaza.biz/c/founding-members). Proof that a second business is configuration, not a second app |
| Source | [verified on Snowtrace](https://testnet.snowtrace.io/address/0xECa2c9067355410EdFc1622246c64d6F1b29038E#code) |
| Previous deployments | [`0x04AE7084…02086`](https://testnet.snowtrace.io/address/0x04AE7084ba8f52BEb6186885FD1A091f7d602086) — identical source, carries the earlier demo state; [`0xF8A2612e…b7b86`](https://testnet.snowtrace.io/address/0xF8A2612e80fA7Ccc093F5c1B2a95b827fD0b7b86) — superseded when `submitActivity` was added. Contracts here are immutable, so a redeploy is always a new address and always starts empty |

Deploying yourself writes the same values to `contracts/deployments.json`, which is
untracked. Point `web/.env.local` at whichever deployment you're using.

The contract is still called `TangazaRewards` — it was deployed under that name before
the project was renamed, and the source in this repo is the exact source that produced
the bytecode at the address above. Renaming it would mean redeploying and re-seeding,
which would throw away the demo state. A contract's name isn't part of its ABI, so
nothing in the app depends on it.

---

## The one-sentence version

A customer submits an activity — their own wallet records it on-chain and the proof
stays private → the business approves it on-chain → every 20 approved activities mints
one KES 500 reward credit → the customer claims it for airtime → the business's
outstanding liability drops by KES 500. Everyone acts as a plain EOA: social login
gives you an embedded self-custodial key (no seed phrase, signs without prompts), Core
and MetaMask users sign in their own extension. Every transaction pays its own gas —
fractions of a cent on Fuji — from the 0.001 testnet AVAX the app requires you to hold
before you can submit or approve — pushed to new wallets automatically by the in-app
faucet, with the [Core faucet](https://core.app/tools/testnet-faucet/) as the manual
fallback.

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

## What a business rewards is its own decision

The contract deliberately knows nothing about this. `ActivityType` is a three-value
enum and `CREDIT_VALUE_KES` / `MILESTONE_ACTIVITIES` are `constant` — none of it can be
reconfigured without redeploying, which is the point: the solvency rules are not a
setting.

The *product* on top of it is configurable. A business defines any number of
**engagement types** in Postgres — what it's called, what proof to ask for, and what
it's worth:

| | proof asked for | weight |
|---|---|---|
| 🤝 Walk-in referral | their name + your referral link | **5** |
| 📸 Instagram Reel | link to the Reel | **5** |
| 𝕏 Shout-out on X | link to the post | **2** |
| 💬 WhatsApp status | screenshot | **1** |

**`weight` is the reward dial**: how many on-chain activities one approval counts for.
Approving a weight-5 referral calls `approveActivityBatch` with the entry repeated five
times, so at 20 activities per KES 500 credit a referral is a quarter of a reward and a
WhatsApp status is a twentieth. Differentiated pricing, with the emission cap and the
milestone still doing the enforcing.

Label, icon and weight are **copied onto each submission** when it is filed, so renaming
or retiring an engagement type never rewrites what people already did.

`web/db/002_example_engagements.sql` seeds the table above with eleven submissions from
six advocates, mixed approved / pending / rejected.

---

## Layout

```
contracts/   Hardhat + TypeScript + Solidity 0.8.24 + OpenZeppelin v5
             TangazaRewards.sol, 45 tests, deploy + seed scripts
web/         Next.js (App Router) + TypeScript + Tailwind v4 + thirdweb v5 + viem
             Advocate surface (/), business surface (/org)
             API: /api/activities, /api/engagement-types, /api/standings
web/db/      Postgres schema and seeds. Apply with psql; every file is idempotent.
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
npx hardhat test            # 45 passing
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
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | from step 3, or the existing one under [Deployed](#deployed) |
| `NEXT_PUBLIC_CHAIN` | `fuji` |
| `NEXT_PUBLIC_ORG_ID` | `1` |
| `NEXT_PUBLIC_DEPLOY_BLOCK` | `blockNumber` from `contracts/deployments.json`, or `57298496` for the deployment above — event scanning starts here |
| `NEXT_PUBLIC_ORG_APPROVER` | the approver's smart-account address; blank = any signed-in account (dev only) |
| `DATABASE_URL` | Postgres connection string — see step 6. **No `NEXT_PUBLIC_` prefix**: that would inline a database password into the browser bundle |

### 6. Database

Any Postgres works; [Neon](https://neon.tech) has a free tier and the app uses its HTTP
driver, which suits serverless better than a connection pool.

```bash
psql "$DATABASE_URL" -f db/001_init.sql              # schema
psql "$DATABASE_URL" -f db/002_example_engagements.sql   # optional demo data
```

Both files are idempotent — re-running them is safe.

```bash
npm run dev     # http://localhost:3000
```

If you change the contract, re-sync the ABI: `cd contracts && npx hardhat compile`
then `cd ../web && npm run sync:abi`.

### 7. In-app faucet (optional but recommended)

New users know nothing about testnets, and the Core faucet now wants a mainnet
balance or a coupon — so the app can fund them itself. Generate a fresh key, put it
in `.env.local` as `FAUCET_PRIVATE_KEY`, and send it some Fuji AVAX to be the
reserve. From then on, a signed-in wallet below the 0.001 AVAX gate gets
`FAUCET_DRIP_AVAX` (default 0.005) pushed to it automatically — the gate shows
"setting up your account" instead of faucet instructions. Unset, everything falls
back to the manual Core-faucet card. Guards live in `web/lib/faucet.ts`: once per
address ever, only when actually below the gate, per-IP and global daily caps.

---

## Running the demo

The judging story is one unbroken earn → redeem journey.

1. **Sign in as a customer** at `/`. Google, X, email, **Core** or **MetaMask**. No
   seed phrase appears for the social logins, because the in-app wallet is an embedded
   key wrapped in an ERC-4337 smart account — and a browser wallet gets the same
   treatment, signing as the admin key of a sponsored smart account rather than paying
   its own gas. Either way the address the app sees is the smart account's.
2. **Submit an activity** at `/submit` — the form lists whatever the business
   configured, each showing what it's worth. Paste the proof it asks for. **Your
   wallet writes this on-chain**: submitting calls `submitActivity()` gaslessly, the
   success screen links your own transaction, and the API only accepts the submission
   after verifying that transaction's `ActivitySubmitted` log — `msg.sender` is the
   identity, so nobody can file as someone else.
3. **Sign in as the org** at `/org` (a second browser profile is easiest). The
   submission is in the approvals queue with its proof link.
4. **Approve it.** That calls `approveActivityBatch()` on Fuji, gaslessly, with the
   entry repeated `weight` times. Approving one walk-in referral moves the advocate
   five activities, not one.
5. **Cross 20 activities** and one KES 500 credit mints. Seed `DEMO_ADVOCATE` to your
   customer smart-account address so it sits at 19 — then a single approval on stage
   mints the credit live. (With a weight-5 engagement, sitting at 15 works too.)
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
business on a public chain, and neither does a business's private view of who its
advocates are. Only the approval and the redemption are written on-chain.

The queue started as a JSON file, which was fine locally and impossible on Vercel —
the filesystem there is read-only outside `/tmp`, so every submission 500'd in
production. It is Postgres now (`web/db/001_init.sql`). Because every caller had always
gone through `web/lib/store.ts`, that swap touched one file; the functions went from
synchronous to async and nothing else moved.

**Approval is idempotent.** `decideActivity` updates `where id = … and status =
'pending'`, so a double-click or a retry after a timeout cannot decide the same
submission twice and mint against the budget a second time.

**How events are read.** `web/lib/events.ts` asks the [AvaCloud Data API](https://developers.avacloud.io)
for the contract's indexed transaction list (keyless on Fuji, CORS-open), reads those
receipts, and decodes the logs — work proportional to what the contract has actually
done, not to how old the chain is. If the Data API is unreachable it falls back to
scanning `eth_getLogs` in 900-block windows (Avalanche's RPC caps ranges at 1000).
Set `NEXT_PUBLIC_AVACLOUD_API_KEY` for production rate limits.

**Why there are no smart accounts, measured.** The app shipped with ERC-4337 smart
accounts and sponsored gas, and fought a long war with them: first transactions
outliving the SDK's wait, AA25 lockouts, a warmup that could strand the very
transaction it existed to speed up. The war ended with a headless measurement
(2026-07-30, production client id, Origin set): thirdweb's Fuji bundler estimates gas,
gets the paymaster signature, **accepts the userOp — and never mines it**. Not one
smart-account submission ever reached the contract. A plain Fuji transaction mines in
about 2 seconds. So every path is bundler-free now: social login yields an embedded
self-custodial EOA that signs silently; Core and MetaMask — discovered over EIP-6963,
since `window.ethereum` can't tell two extensions apart — sign in the extension.
Everyone pays their own (near-zero) gas from the 0.005 AVAX the funds gate requires.
The recovery machinery this fight produced (`web/lib/warmup.ts`, the AA10 branches in
the submit and approve flows) stays in the code: inert while nothing registers a
warmup, and exactly what you'll need again if sponsorship ever returns.

**Why the faucet is a server key, not a contract.** A brand-new wallet holds nothing,
so it cannot call a faucet contract — whatever funds it must move first. The in-app
faucet is therefore a plain transfer from a server-held key (`web/lib/faucet.ts`),
with the policy in Postgres and on-chain checks rather than bytecode: one drip per
address ever (claimed by insert before the send, so concurrent requests race on the
row, not the transfer), only for balances actually below the gate, under per-IP and
global daily caps. The key is its own small-reserve account — draining it is the
worst case, and it fails closed: unset or dry, the UI falls back to the Core-faucet
instructions.

**The standing sharp edge**: the contract's registered approver must match the address
the connection actually produces, or every approval reverts `NotApprover`. Changing
the wallet model changes the addresses — orgs 1 and 2 were re-registered to their
EOAs when the wrapping came off.

**Why `viaIR` is on.** The contract hits "stack too deep" without the IR pipeline.
Optimizer runs: 200.

**The liability chart** is an emphasis chart, not a two-axis chart: outstanding
liability carries the accent hue because it's the story, committed-to-date is gray
context, and the cap is a dashed threshold. The palette validates on the dark surface
at CVD ΔE 9.5 / normal-vision ΔE 22.7, both marks above 3:1 contrast. It ships with a
crosshair tooltip, keyboard navigation, and a table view so no value is hover-gated.

---

## Scope

Built: the Blockchain Centre pilot, end to end. A second business is configuration, not
a second app — it registers on-chain with its own cap and then defines its own
engagement types.

**The org approver must be set on-chain before approvals work.** `registerOrg` records
an approver address, and `_authorizeApproval` admits only that address or the contract
owner. If you sign in at `/org` with a smart account that isn't the registered approver,
every approval reverts `NotApprover`. Fix it with:

```bash
cd contracts
APPROVER=0xYourSmartAccountAddress npx hardhat run scripts/set-approver.ts --network fuji
```

Closed-loop only. Credits are non-transferable records inside the contract, not a
tradeable token: there is no `transfer`, no allowance, no market.
