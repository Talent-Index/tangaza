# Ubu-Tangaza — Submission copy

Copy-paste for the submission form. Framing: business-first — grow through trackable
referrals, reward what customers *do* for the business.

---

## Short description (overview)

Ubu-Tangaza helps your business grow through trackable referrals. Reward your customers
and clients for what they actually do for you — bringing in new clients, referring a
friend, spreading the word — with proof behind every action and a reward budget you
control. Ubu-Tangaza is there for your business.

---

## Detailed description

Your customers already grow your business — they bring you clients, refer their friends,
talk you up. You just can't see *which* ones, or reward them for it. The client who's
sent you fifteen people gets the same thank-you as everyone else, so the behavior never
compounds. Ubu-Tangaza changes that.

You decide what counts and what it's worth: a referral, a new client brought in, a post,
a visit. You set the reward in your own form and currency — 500 KSh airtime, 10% off, a
free product, merch — and the levels people climb ("5 referrals → free cut"). Your
community gets a shareable link, does what they already do for you, and attaches proof:
the actual post, a photo of the receipt or the visit. It lands in a one-tap approval
queue, and you get something no business has today — a live, trackable view of who is
actually growing your business, and exactly what you owe them.

The trust runs on-chain, invisibly. Each business registers on Avalanche with a reward
budget written once — no function exists to raise it — and every approved action is
attested by the business's own wallet as a tamper-proof record. Your customers can never
be quietly stiffed; your costs can never run past the budget you set, even if you go
viral; and nobody has to take a dashboard's word for it. Your customers sign in with
Google and never see a wallet or a token — the blockchain is plumbing they never touch.

Born at the Avalanche Team1 Game Jam in Nairobi (a top project — 155 people joined a
campaign in a single night, and businesses registered themselves through the product
before the demo ended), Ubu-Tangaza is now focused on retail & SME loyalty: the coffee
shops, salons, and boutiques that live on referrals. Live at ubutangaza.biz with a
merchant waitlist and a referral pilot targeting 15 verified referred purchases across
three shops.

---

## Technical details (stack, integrations, architecture, "hacky" parts)

**Frontend/Backend:** Next.js 16 (App Router, React 19, TypeScript, Tailwind v4) on
Vercel — API routes double as the backend.

**Data:** Neon serverless Postgres over its HTTP driver (one stateless query per
invocation, which suits serverless better than a connection pool).

**Chain:** Solidity contract (`TangazaRewards`, Hardhat) on Avalanche Fuji. thirdweb SDK
for ERC-4337 smart accounts and social login; viem for server-side signature and receipt
verification.

**Integrations:**
- **Safaricom Daraja (M-Pesa C2B)** — read-only payment confirmations that match a Till
  payment to a referral code, so a referred purchase is verified automatically. No
  custody, no payouts through us.
- **Cloudinary** — unsigned uploads for photo proof (receipts, visits) and campaign covers.
- **Google Apps Script** — business waitlist submissions appended to a Sheet.
- **In-app gas faucet** — drips Fuji AVAX to new smart accounts so first-time users
  transact without ever holding crypto.

**Architecture — a deliberate on-chain/off-chain split.** The chain holds only what must
be tamper-proof: business identity + approver, an immutable per-business reward budget
(set at `registerOrg`, with no raise function), approved-activity counts, and activity
attestations (the advocate's own smart account submits; the business's approver wallet
approves — `msg.sender` *is* the identity under ERC-4337). Everything a business should
be free to change — engagement types with weights, reward menus in any currency and
form, levels, campaigns — lives in Postgres. Proof files stay off-chain; only their hash
is committed on-chain, binding each approval to one specific submission.

**Worth highlighting:**
- **Session-less auth for every business action** — authorized by a wallet signature
  over a canonical message, verified server-side with viem's ERC-6492-aware
  `verifyMessage`, which validates signatures from smart accounts that haven't been
  deployed yet (deployment is deferred to first transaction). No sessions, no JWTs.
- **M-Pesa attribution without money transmission** — a referrer's short share code
  doubles as the M-Pesa account reference; the Daraja C2B callback matches Till + code →
  merchant + referrer and records a verified referred purchase, idempotent on `TransID`.
  We only *read* payments — no custody — keeping the platform outside VASP scope while
  payouts stay merchant-honored.
- **Receipts as authorization** — approval endpoints don't trust the caller; they read
  the `ActivityApproved` log from chain. The contract already rejects non-approvers, so
  the event *is* the auth.
- **Gasless UX** — an in-app faucet drips gas to new smart accounts, so a first-time user
  goes social-login → on-chain submission without ever seeing crypto.

---

## Technologies (pick from the event list)

TypeScript · Next.js · React · Tailwind CSS · Solidity · Hardhat · Avalanche · thirdweb ·
viem · PostgreSQL (Neon) · Vercel · Cloudinary · M-Pesa / Daraja API · Node.js

---

## Links

- **GitHub:** https://github.com/Talent-Index/tangaza  *(must be public — flip visibility first)*
- **Live / demo:** https://ubutangaza.biz · https://ubutangaza.biz/waitlist ·
  https://ubutangaza.biz/videos/launch.html
- **Deck:** link `pitch/Ubu-Tangaza-pitch.pdf` from a public Google Drive folder

---

## Project continuity & development

Ubu-Tangaza started at the Avalanche Team1 Game Jam (Nairobi). What existed before this
program: the `TangazaRewards` contract (immutable per-business budgets, milestone
credits, on-chain activity attestation), gasless smart-account onboarding via social
login, submissions/approvals, campaigns with share tracking, and the advocate
leaderboard.

**Built during this program (August 2026):**
- **Flexible reward engine** — the business-facing reward is no longer a fixed KES
  credit. A business now rewards in any currency (KES/USD/EUR/NGN/…) and any form (cash,
  airtime, voucher, discount, free product, merch), with editable business profiles.
- **Trackable per-activity goals** — targets tied to a specific action ("5 referrals →
  free T-shirt"), measured per engagement type, alongside total-activity levels; plus a
  per-campaign activity feed so a business can track every action under a campaign.
- **Photo proof** — advocates snap or upload a receipt/visit photo (Cloudinary) instead
  of pasting links; businesses see it inline in the approval queue, each approved action
  linked to its on-chain proof transaction.
- **M-Pesa referral pilot** — Daraja C2B integration matching Till payments to referral
  codes for auto-verified referred purchases, with a zero-management merchant dashboard
  (`/org/pilot`) tracking "who you owe" and progress to the pilot target.
- **Security hardening** — signature-based (ERC-6492-aware) authorization on all
  business mutations; on-chain proof links across the client directory and activity feeds.
- **Go-to-market surface** — business waitlist with the value proposition, a
  `/for-business` QR + one-tap-share recruiting tool, a launch article, and refreshed
  retail-SME positioning throughout.

Modifications/optimizations: the reward model was decoupled from the fixed on-chain
credit (off-chain menu keyed to on-chain activity counts) so a business can be fully
flexible without touching the solvency guarantees; the DB access moved to Neon's HTTP
driver for serverless; explicit gas pinning on contract writes for Fuji's fee behavior.

---

## Visual identity & media (notes)

- **Logo (512×512 PNG):** need a square export of the brand mark.
- **Screenshots (≤5):** `/waitlist` (pitch) · Rewards setup (currency + goal editor) ·
  campaign detail (invite link + activity feed) · approvals queue with photo proof ·
  `/org/pilot` (referral dashboard).
- **Demo video:** the form requires clear voiceover, **no background music**, on
  YouTube/Vimeo — record a 1–2 min screen walkthrough, NOT the music motion-graphic.
