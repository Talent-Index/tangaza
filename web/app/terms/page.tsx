import Link from "next/link";
import { LegalSection as S, LegalShell } from "@/components/site/Legal";
import { CONTACT } from "@/lib/contact";

export const metadata = {
  title: "Terms of Service — Ubu-Tangaza",
  description: "The terms that govern businesses and advocates using Ubu-Tangaza.",
};

/**
 * Written to be read: short sections, plain English, and nothing that contradicts how
 * the product actually works (trust-based rewards, capped budgets, credits, on-chain
 * records). Substantive changes here should be reviewed by counsel.
 */
export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="23 October 2026">
      <S n={1} h="What Ubu-Tangaza is">
        Ubu-Tangaza (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a platform that lets a business
        run reward campaigns: customers and advocates take verifiable actions — referrals,
        posts, visits, bookings — the business approves what is real, and the business
        honours the rewards it has offered. We provide the tracking, verification and
        record-keeping. These terms are a contract between you and Ubu-Tangaza, operated
        from Nairobi, Kenya.
      </S>

      <S n={2} h="Accounts">
        Businesses register with a wallet that becomes their approver — the only account
        able to approve activities and change campaign settings. You are responsible for
        keeping control of that account. Advocates sign in with Google, X, email or their
        own wallet. You must give accurate information and be able to enter a contract
        under Kenyan law.
      </S>

      <S n={3} h="Campaigns and credits">
        A business&rsquo;s first two campaigns are free. After that, creating a campaign
        consumes one campaign credit, bought at the prices shown on{" "}
        <Link href="/pricing" className="underline underline-offset-4">
          our pricing page
        </Link>
        . Credits do not expire. Campaigns that were free when created remain free — we do
        not apply pricing retroactively.
      </S>

      <S n={4} h="Payments and refunds">
        Credits are paid for by M-Pesa against an exact amount and a payment reference we
        issue at checkout. Every confirmed payment leaves a receipt in your dashboard. A
        credit that has not been consumed can be refunded on request. A payment we cannot
        attribute to any checkout is held for manual review and either matched, refunded
        or returned — it is never kept silently.
      </S>

      <S n={5} h="Rewards are the business's promise, not ours">
        Rewards offered in a campaign — cash, airtime, vouchers, discounts, products — are
        offered by the business and honoured by the business. Ubu-Tangaza never holds,
        sends or guarantees reward money. What we do enforce: each business registers
        with a reward budget written once on-chain that no one, including us, can raise,
        and we keep the ledger of what has been earned, given and owed so advocates are
        not quietly stiffed.
      </S>

      <S n={6} h="The on-chain record">
        Approvals, reward budgets and related events are recorded on the Avalanche
        blockchain. That record is public and permanent by design — it is what makes the
        ledger trustworthy — and it cannot be edited or deleted by us or by you. Proof
        you submit (links, images) stays off-chain.
      </S>

      <S n={7} h="Acceptable use">
        No fabricated proof, self-referrals, bought engagement, impersonation, unlawful
        campaigns, or attempts to manipulate approvals or payments. Businesses must
        honour rewards that advocates have legitimately earned. We may suspend or close
        accounts that break these rules; earned, unpaid reward obligations survive a
        business&rsquo;s suspension.
      </S>

      <S n={8} h="Your content">
        You keep ownership of what you upload (campaign images, proof, descriptions) and
        give us the licence needed to store and display it so the service works. Do not
        upload content you have no right to share.
      </S>

      <S n={9} h="Service, liability and changes">
        The service is provided as-is. We work to keep it accurate and available, but we
        are not liable for a business failing to honour its rewards, for losses from
        events outside our control (including blockchain network or mobile-money outages),
        or for indirect losses. Our total liability to you is capped at the fees you paid
        us in the twelve months before the claim. We may update these terms; material
        changes will be announced on this page with a new date, and continued use means
        acceptance.
      </S>

      <S n={10} h="Governing law and contact">
        These terms are governed by the laws of Kenya. Questions, complaints or notices:{" "}
        <a href={`mailto:${CONTACT.email}`} className="underline underline-offset-4">
          {CONTACT.email}
        </a>
        .
      </S>
    </LegalShell>
  );
}
