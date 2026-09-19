# Pitch Perfect — booth playbook

Not a stage pitch. A table, a laptop, a phone, and a stream of partners, builders and
founders walking past. You win the day by (1) getting people to *use* it at the table and
(2) walking away with named merchant leads. Everything below serves those two.

**Day goal:** 5 merchants who say "run it in my shop" (name + WhatsApp number), 20 waitlist
scans, and 3 partner conversations (payments, SME networks, accelerators).

---

## 1. The product and the problem, in three lengths

**One line (say this first, every time):**
> Ubu-Tangaza lets a local business see, track and reward the customers who bring it new
> customers — with proof for every action.

**30 seconds (the walk-past):**
> Every shop owner says "my customers bring their friends", but nobody can name *who*.
> The regular who has sent you fifteen people gets the same thank-you as everyone else,
> so it never compounds. With Ubu-Tangaza a business says what it rewards — a referral,
> a post, a visit — and what it's worth, in its own currency and form: 500 bob airtime,
> 10% off, a free cut. Customers share a link, do what they already do, attach proof.
> The business approves in one tap and sees exactly who is growing it and what it owes
> them. Want to try it? Scan this, you'll be in a campaign in ten seconds.

**2 minutes (the interested one):** 30-second version, then:
> Two things make this different from a loyalty card. First, it rewards *growth*
> actions, not spend — bringing a customer, not buying a coffee. Second, the trust is
> enforced, not promised. Each business sets a reward budget that's written once on
> Avalanche and can never be raised, and every approval is signed by the business's own
> wallet. So the customer can't be quietly stiffed, the business can't overspend even if
> it goes viral, and neither has to take our dashboard's word for it. The customer just
> signs in with Google — they never see a wallet.

**Never lead with:** blockchain, web3, tokens, Avalanche. If asked "is this crypto?":
> "It runs on Avalanche, but only as the record-keeper. No tokens, no wallets to manage,
> nothing to buy. Your customers sign in with Google."

## 2. ICP and business model — the two questions judges always ask

**Who is the customer (ICP):** owner-operated shops in one Nairobi neighbourhood at a
time — coffee/tea spots, salons and barbershops, boutiques, gyms and studios. 1–15 staff,
owner decides same day, M-Pesa Till on the counter, marketing is WhatsApp status and
Instagram, no CRM. Pain trigger: they say "customers bring their friends" but can't name
who. Not for: franchises, online-only, anyone who needs a committee.

**Who is the user:** the shop's regulars. They arrive *through* the shop. Deals drive
users, so all acquisition effort points at merchants.

**Business model (say it plainly, don't oversell):**
- Free pilot now. We are validating willingness to pay with the shops in the pilot.
- Leading model: a **per-verified-referral fee, KES 20–50**. The shop pays only when we
  provably brought a customer. Aligned incentives, easy yes.
- Fallback: flat KES 500–1,500/month once a shop is habituated.
- Never: a cut of the reward (poisons trust) or charging the customer (kills supply).
- The reward itself is the shop's own money or product, honoured by the shop. We never
  hold or move funds, which keeps us outside VASP licensing.

**If asked about unit economics:** a salon paying KES 30 per referred client who spends
KES 800+ is a 3–4% acquisition cost. Compare that to nothing — most have no measurable
acquisition channel today.

## 3. Demo — 3 minutes, on the visitor's own phone

Set-up before doors open: laptop on the business portal (Overview) signed in as Nancy
Bakes; your phone on the advocate home; a live campaign with a fresh share link ready;
a second window with Snowtrace open on the contract.

1. **Hook (visitor's phone):** "Scan this." They scan the campaign QR, sign in with
   Google, land in "Celebrate September with Nancy cakes". *"That's it — you're an
   advocate for a bakery. No app store, no wallet."*
2. **Do (visitor's phone):** they tap Submit an activity, pick "Referral", type a name,
   send. *"You've just told the bakery you brought them a customer."*
3. **Approve (laptop):** it appears in the Approvals queue. Tap Approve. *"One tap. That
   approval is now signed by the bakery's wallet on Avalanche."* Click the tx link on
   Snowtrace if they're technical, skip if not.
4. **See (laptop → Rewards page on their phone):** show Rewards setup — "5 referrals →
   free cake slice", "15% off after 10 activities" — then on their phone the Rewards
   page shows the ladder and "4 to go". *"The customer always knows exactly where they
   stand, the business always knows exactly what it owes."*
5. **Close:** Overview → Liability. *"Budget set once, can't be raised. That's the whole
   trust story."* Then: "Which shop do you know that this would work for?"

**Fallback if the RPC is slow or Wi-Fi dies:** the 63-second launch video on the laptop
(`web/public/videos/ubu-tangaza-launch.mp4`) and the phone-only flow on mobile data.

**Reset between demos:** reject the test submission or approve it — either is fine, the
queue stays clean. Keep one campaign purely for demos so real merchant data isn't touched.

## 4. Traction — what to say, all true

| Point | What to say |
|---|---|
| Origin | Top project at Avalanche Team1 Game Jam, Nairobi. 155 people joined a campaign in one night; businesses registered themselves through the product before the demo ended |
| Accelerator | Ranked #4 (7.33/10) in the incubation cohort; Retail & SME Loyalty track; now in incubation |
| Live | ubutangaza.biz. 5 businesses registered on-chain with their own approver wallets, 5 live campaigns, 22 campaign joins, 40+ on-chain approvals and reward transactions |
| Product depth | Businesses set their own rewards (any currency, cash or not), levels and per-activity goals, run campaigns with share links, approve with photo/link proof, see liability live |
| Pilot | M-Pesa Till referral pilot built: a referred Till payment auto-verifies a referral through Daraja C2B, no custody. Target: 15 verified referred purchases across 3 shops in 10 days |
| Next | Recruiting the 3 pilot shops — that's what today is for |

Don't inflate. If someone asks "how many paying customers": "None yet, on purpose. The
pilot is free until we have willingness-to-pay data from the first three shops."

## 5. Objections you'll hear, and the answer

- **"Why does this need a blockchain?"** — "Because a promise to reward people is
  worthless if the business can quietly change it. The budget is written once and the
  approvals are signed. That's the part a normal database can't give you. Everything
  else is a normal web app."
- **"Shops won't manage another dashboard."** — "Agreed, that's the killer requirement.
  One-tap approvals, and with the M-Pesa pilot a referred Till payment verifies itself.
  The goal is zero babysitting."
- **"Customers won't bother."** — "They already do it for free. We're just making it
  visible and paid. 155 people joined one campaign in a night when there was a reward."
- **"What about fraud — fake referrals?"** — "The business approves every one, proof is
  attached, and with the Till integration the referral is only counted when money
  actually arrived."
- **"How is this different from a loyalty card / stamp app?"** — "Those reward spending.
  We reward bringing customers. Different behaviour, different economics."
- **"Is this legal with M-Pesa?"** — "We read payment confirmations for attribution
  only. We never hold or send money. The shop pays its own reward."

## 6. Brochure and QR

Print `pitch/brochure.html` (open in Chrome → Print → A5 or A4, double-sided, 40 copies).
Front: the one-liner, three benefits, the QR. Back: how it works in four steps and what
a reward can be. The QR points at **ubutangaza.biz/waitlist** (the business waitlist,
which lands in your Google Sheet), so every scan is a lead you can follow up.

Also print one A4 of just the campaign QR for the table stand — that's the demo entry.

## 7. Sales game at the table

- **Qualify in one question:** "Do customers bring you customers?" Shop owner or knows
  one → pitch. Investor/partner → 2-minute version and ask what they're looking for.
- **Capture every lead in the same place:** the waitlist form on your phone, filled in
  by you while talking. Name, business, WhatsApp. Don't rely on business cards.
- **The ask, always concrete:** "Can I set your shop up this week? Takes ten minutes, it's
  free, and I'll come to you." Get a day.
- **Partners to look for:** M-Pesa/payments people (Daraja C2B go-live), SME
  associations and neighbourhood business groups (density), other founders with
  merchant networks. Ask each one for two introductions.
- **Feedback to collect (write it down):** what they'd reward, what they'd pay, what
  they'd never do. This is the Phase 0 interview data the accelerator asked for.
- **Follow up within 24h** with the same message to everyone: link, one line, your
  offer to set them up.

## 8. Checklist

- [ ] Laptop charged + charger, signed in to business portal as Nancy Bakes
- [ ] Phone on mobile data (don't trust venue Wi-Fi), signed in as an advocate
- [ ] Demo campaign live with a share link; campaign QR printed A4 for the stand
- [ ] 40 brochures, double-sided
- [ ] Launch video downloaded locally on the laptop
- [ ] Snowtrace tab open on the contract
- [ ] Waitlist form bookmarked on phone for lead capture
- [ ] Rewards setup for Nancy Bakes shows real rewards (not Centre text — run migration 015)
- [ ] Deck PDF on the laptop in case a judge asks for slides
- [ ] Water, and a second person to hold the table when you go network
