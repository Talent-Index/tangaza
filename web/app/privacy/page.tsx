import { LegalSection as S, LegalShell } from "@/components/site/Legal";
import { CONTACT } from "@/lib/contact";

export const metadata = {
  title: "Privacy Policy — Ubu-Tangaza",
  description:
    "What Ubu-Tangaza collects, why, who it is shared with, and your rights under Kenya's Data Protection Act, 2019.",
};

/**
 * Deliberately specific: it names the actual data the app stores (including M-Pesa
 * transaction data from Daraja and what ends up on-chain) rather than boilerplate.
 * Substantive changes should be reviewed by counsel and kept in sync with reality.
 */
export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="23 October 2026">
      <S n={1} h="Who is responsible">
        Ubu-Tangaza, operated from Nairobi, Kenya, is the data controller for the personal
        data described here, processed in line with Kenya&rsquo;s Data Protection Act,
        2019. Contact:{" "}
        <a href={`mailto:${CONTACT.email}`} className="underline underline-offset-4">
          {CONTACT.email}
        </a>
        .
      </S>

      <S n={2} h="What we collect">
        <strong className="text-mist-200">Businesses:</strong> business name, contact
        person&rsquo;s phone and email, address or website, social handles, the approver
        wallet address, and the signed pledge.{" "}
        <strong className="text-mist-200">Advocates:</strong> the name and email from your
        Google, X or email sign-in, a wallet address created for or connected by you, and
        the activity you submit — including proof such as links, screenshots or photos.{" "}
        <strong className="text-mist-200">Payers:</strong> when a payment is made through
        M-Pesa (a referral purchase at a business&rsquo;s Till, or a campaign-credit
        purchase), we receive transaction data from Safaricom&rsquo;s Daraja API: the
        transaction ID, amount, the paying phone number and first name, and the reference
        typed with it.
      </S>

      <S n={3} h="Why we use it">
        To run the service: verifying referrals and activities, keeping the earned/given/
        owed reward ledger, attributing payments to the right business, showing a business
        who brought them customers, preventing fraud, and contacting you about your
        account. We do not sell personal data, and we do not use it for third-party
        advertising.
      </S>

      <S n={4} h="What is public and permanent">
        Approvals, reward budgets and credits are recorded on the Avalanche blockchain
        against wallet addresses. That record is public and cannot be altered or deleted —
        by design, and by anyone. We keep names, phone numbers, proof and payment details
        off-chain; a wallet address alone does not name you, but anything you do that
        links your address to your identity is outside our control.
      </S>

      <S n={5} h="Who we share it with">
        Service providers who host and run the platform: Vercel (hosting), Neon
        (database), Cloudinary (image uploads), Safaricom Daraja (M-Pesa data, as above),
        our email provider, and the Avalanche network (on-chain records only). Each
        receives only what its job needs. We disclose data to authorities only when
        lawfully required.
      </S>

      <S n={6} h="How long we keep it">
        Account and ledger data for as long as the account is active, and afterwards for
        as long as reward obligations or legal duties require. Payment records are kept as
        required by Kenyan law. You can ask us to delete your off-chain data — see your
        rights below.
      </S>

      <S n={7} h="Your rights">
        Under the Data Protection Act, 2019 you may ask what we hold about you, have
        inaccuracies corrected, object to processing, or ask for deletion of your
        off-chain data. On-chain records cannot be deleted by anyone, which is why we keep
        identifying details off-chain. Write to{" "}
        <a href={`mailto:${CONTACT.email}`} className="underline underline-offset-4">
          {CONTACT.email}
        </a>{" "}
        and we will respond within 30 days. You may also complain to the Office of the
        Data Protection Commissioner.
      </S>

      <S n={8} h="Security and changes">
        Data is encrypted in transit, credentials are stored server-side only, and
        business mutations require a cryptographic signature from the business&rsquo;s own
        approver account. If this policy changes materially, the date above changes with
        it and the current version always lives at this address.
      </S>
    </LegalShell>
  );
}
