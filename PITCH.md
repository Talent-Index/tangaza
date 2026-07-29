# Ubu-Tangaza — pitch deck

> 3 minutes, strictly timed. The demo is the product; slides exist to frame it.
> Present from a phone + laptop: phone = advocate, laptop = business.

---

## Slide 1 — Title `0:00–0:15`

**Ubu-Tangaza** — *what you say for your community, and what your community gives back.*

> **Say:** "Ubu from ubuntu — a person is a person through other people. Tangaza —
> Swahili, to announce. We pay people for real advocacy, from a budget that can
> never be raised. Live on Avalanche Fuji right now — everything I show you is a
> real transaction."

---

## Slide 2 — The problem `0:15–0:40`

Kenyan SMEs run on word of mouth — and can't pay for it safely.

- Loyalty points get minted freely → liability nobody budgeted → programs die
- Influencer spend is unverifiable — you pay for reach, not results
- The people who actually bring customers through the door get nothing

> **Say:** "Every business here knows the customer who brings five friends and
> gets a handshake. And every business that tried points knows the other failure:
> unlimited emission, unbudgeted liability. We fix both with one contract."

---

## Slide 3 — The behaviour, the metric *(the Routledge test)* `0:40–1:00`

| | |
|---|---|
| **Behaviour** | A member **brings a person through the door, or posts about the business** — and their own wallet records it on-chain |
| **Metric** | **Cost per verified advocacy action (KES)** — committed budget ÷ approved activities. Live on our dashboard **today: KES 15** for the pilot org |
| **Repeat behaviour** | On-chain **streaks** (consecutive active days) and **levels** (Regular → Champion → Founder's Circle) |

> **Say:** "Name the behaviour: bring a friend, post about us. Name the metric:
> cost per verified advocacy action — our pilot's dashboard reads fifteen
> shillings, computed on-chain, right now."

---

## Slide 4 — One loop, one mechanic `1:00–1:20`

```
advocate's wallet writes the activity on-chain (submitActivity, gasless)
        → business approves with ITS wallet (contract rejects anyone else)
        → every 20 approved activities mints a KES 500 credit
        → burn-on-redeem: airtime / data / voucher — liability shrinks
```

Scoped brutally: **one behaviour, one mechanic**. Composed from the cohort's
building blocks — capped token + streaks + tiers — in one 45-test contract.

---

## Slide 5 — LIVE DEMO `1:20–2:20` *(the minute that matters)*

**Runbook — rehearsed, two Core accounts, zero external dependencies:**

1. **Phone, advocate (Core account 2):** open the campaign → *Submit an activity*
   → Core prompts → sign → **"Recorded on Avalanche" + tx hash on screen**
2. **Laptop, business (Core account 1):** `/org` queue shows it, with the
   *"submitted on-chain by their wallet"* Snowtrace link → **Approve** → Core
   prompts → sign → ✓ mined, advocate's count and streak move on-chain
3. Flash `/org/liability`: committed up, cap fixed, books balanced

> **Say while signing:** "No placeholder data. That's her wallet writing to Fuji…
> and that's the business's wallet approving. The contract just refused every
> other signer on this chain."

**Backup if the network stutters** — already-mined lifecycle, links in appendix:
submission → approval → credit mint → **burn on redemption**. Every step a real
Fuji transaction from this week.

---

## Slide 6 — Can it survive success? `2:20–2:45`

The four rules, enforced by bytecode — contract is **verified on Snowtrace**:

1. **Budget-backed** — an org cannot register without committing `emissionCapKES`; every credit is KES 500 of airtime/data/voucher
2. **Capped emission** — the cap is written once; **no function in the contract can raise it** (CI pins the full function list — new functions fail the build until reviewed)
3. **Sinks that work** — burn-on-redeem shrinks `outstandingLiability`; redemptions **never reopen minting headroom**
4. **Value from product** — credits are earned by attested behaviour, non-transferable: no `transfer`, no market, no speculation loop

> **Say:** "Success can't bankrupt anyone here. At the cap, activities still
> record — `BudgetExhausted` fires, nothing reverts, only the money stops,
> exactly at the number the business signed for. The chain enforces the CFO."

---

## Slide 7 — Proof, team, ask `2:45–3:00`

- **Deployed, not demoed:** `TangazaRewards` verified on Fuji — `0x04AE7084…2086`
- **Two real businesses on-chain** (pilot + FitTribe, self-served through the product's own registration + pledge flow), **7+ advocates**, full earn→redeem lifecycle already executed
- **Invisible UX:** social login = wallet, sponsored gas, zero crypto vocabulary on the customer surface — or bring your own Core wallet
- **Team:** builder who ships + business brain who scopes + demo owner

> **Close:** "One behaviour, one mechanic, live on Avalanche, and an economy that
> survives its own success. Ubu-Tangaza — we grow together."

---
---

# Appendix (not presented — for judges' questions)

## A1 — Rubric mapping

| Rubric line | Where we meet it |
|---|---|
| Deployed, not demoed — verifiable on Fuji | [Verified contract](https://testnet.snowtrace.io/address/0x04AE7084ba8f52BEb6186885FD1A091f7d602086#code) · live site [ubu-tangaza.vercel.app](https://ubu-tangaza.vercel.app) · every demo step is a Fuji tx |
| Routledge test — behaviour + metric | Slide 3: bring-a-friend / post; **KES per verified advocacy action** (live: KES 15), streaks + tiers for repetition |
| One working end-to-end journey | Slide 5 runbook — submit → approve live; earn → redeem already proven on-chain (A2) |
| Solvency thinking | Slide 6 — the four rules, each with its enforcing function and test |
| Invisible UX | Social login mints the wallet; gas sponsored; advocate surface has no address, no "gas", no seed phrase |
| Mixed team / brutal scope / reuse | One behaviour+mechanic; composes cohort concepts (capped token, streaks, tiers, badges-as-levels) in one contract |

## A2 — On-chain evidence (all Avalanche Fuji, all this week)

| step | tx |
|---|---|
| Advocate's own wallet submits | [`0x10500913…`](https://testnet.snowtrace.io/tx/0x1050091353b84481879b1884f85721e54c3d4b2a09b4b2eebb646f1ad06d44e4) |
| Business approves (batch, weighted) | [`0x7f56ad34…`](https://testnet.snowtrace.io/tx/0x7f56ad34f2d0625c0f5ecbc4c047ac29efff6c0a565e8463837bb86a851417a5) |
| 20th activity → KES 500 credit mints | [`0x0954b9a9…`](https://testnet.snowtrace.io/tx/0x0954b9a9131eea9e054a9575b7d93ac0570f9a3722dd4edbf32d476ede3f6cc0) |
| Advocate burns credit for reward | [`0xfddaaebd…`](https://testnet.snowtrace.io/tx/0xfddaaebd447a57be41de5c5371740607d7932828b04bca0a18b31686c2b764b5) |
| Second business registered via the product | [`0x09346bec…`](https://testnet.snowtrace.io/tx/0x09346bec7dc5868d02279f1608ac63518c202504857faef7ec1281db30877bdf) |

## A3 — Likely judge questions

- **"Why is the approval manual?"** — The approval *is* the product's trust anchor: a credit only exists because a business attested to real behaviour. Automation (X mention ingestion) is designed and schema'd — it auto-*queues*, never auto-*approves*.
- **"What stops sybil farming?"** — Every submission costs the business nothing until a human approves it; weights are priced per engagement; one X account can back only one wallet per business; the cap bounds worst-case loss by construction.
- **"Why Avalanche?"** — 2s finality makes approve-on-stage possible; C-Chain 4337 tooling gives gasless social-login wallets; Core gives a native-wallet story; AvaCloud Data API indexes our events with no infrastructure.
- **"What's KES 15 per activity?"** — Committed budget ÷ approved activities, computed from chain state. It's the number a CMO compares against their cost per acquisition.

## A4 — Pre-demo checklist (do before walking on stage)

- [ ] Core: Account 1 = org approver (has AVAX), Account 2 = advocate (funded 0.1)
- [ ] One full dry run of the loop, then **hand the phone to a stranger and say nothing**
- [ ] Tabs pre-opened: verified contract, A2 tx links, `/org/liability`
- [ ] Phone on Do Not Disturb; laptop on the org queue, signed in
