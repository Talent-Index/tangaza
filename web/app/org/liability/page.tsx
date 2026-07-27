"use client";

import { OrgShell } from "@/components/org/Shell";
import { LiabilityChart } from "@/components/org/LiabilityChart";
import {
  Card,
  ConfigWarning,
  ErrorNote,
  Pill,
  SectionTitle,
  Spinner,
  Stat,
} from "@/components/ui";
import { isConfigured } from "@/lib/client";
import { kes, kesLabel } from "@/lib/format";
import { useOrg, useOrgLedger } from "@/lib/hooks";

/* ------------------------------------------------------------------ screen 8 */

export default function OrgLiabilityPage() {
  return (
    <OrgShell>
      <Liability />
    </OrgShell>
  );
}

function Liability() {
  const org = useOrg();
  const ledger = useOrgLedger();

  if (!isConfigured) return <ConfigWarning />;
  if (org.error) return <ErrorNote>{org.error}</ErrorNote>;

  if (!org.data) {
    return (
      <div className="grid place-items-center py-32">
        <Spinner className="size-6" />
      </div>
    );
  }

  const cap = Number(org.data.emissionCapKES);
  const issued = Number(org.data.issuedKES);
  const redeemed = Number(org.data.redeemedKES);
  const outstanding = issued - redeemed;
  const headroom = cap - issued;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black">Liability</h1>
        <p className="mt-1 text-sm text-mist-500">
          What {org.data.name} still owes its advocates — and the ceiling that can never
          move.
        </p>
      </div>

      {/* Hero figure: the one number this dashboard leads with. */}
      <Card className="flex flex-wrap items-end justify-between gap-6 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
            Outstanding liability
          </p>
          {/* Proportional figures, not tabular — this is a display number. */}
          <p className="mt-2 text-6xl font-black leading-none text-crimson-400">
            {kesLabel(outstanding)}
          </p>
          <p className="mt-3 text-sm text-mist-500">
            {kes(issued)} committed − {kes(redeemed)} already paid out
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill tone={headroom > 0 ? "good" : "bad"}>
            {headroom > 0 ? `${kesLabel(headroom)} of headroom` : "Cap reached"}
          </Pill>
          {ledger.data?.exhausted ? (
            <Pill tone="warn">Budget exhausted — minting has stopped</Pill>
          ) : null}
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Emission cap" value={kesLabel(cap)} hint="Set once. Immutable." />
        <Stat
          label="Committed"
          value={kesLabel(issued)}
          hint="Rewards minted to advocates"
          tone="crimson"
        />
        <Stat
          label="Settled"
          value={kesLabel(redeemed)}
          hint="Claimed and delivered"
          tone="jade"
        />
      </section>

      <section>
        <SectionTitle>Liability over time</SectionTitle>
        <Card>
          {ledger.loading && !ledger.data ? (
            <div className="grid place-items-center py-24">
              <Spinner className="size-6" />
            </div>
          ) : ledger.error ? (
            <ErrorNote>{ledger.error}</ErrorNote>
          ) : (
            <LiabilityChart points={ledger.data?.points ?? []} capKES={cap} />
          )}
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Why this can only shrink</h2>
          <p className="mt-2 text-sm leading-relaxed text-mist-400">
            A reward exists only because you approved a real activity, and it is worth a
            fixed {kesLabel(500)}. When an advocate claims it, the reward is burned and{" "}
            <span className="text-mist-200">settled</span> goes up by the same amount — so
            outstanding falls. Nothing in the contract can mint a reward without an
            approval, and nothing can un-burn a claimed one.
          </p>
        </Card>

        <Card>
          <h2 className="font-semibold">Why the cap can never move</h2>
          <p className="mt-2 text-sm leading-relaxed text-mist-400">
            <span className="text-mist-200">{kesLabel(cap)}</span> was written when{" "}
            {org.data.name} registered. The contract exposes no function that writes it
            again — not for the owner, not for you. At the cap, approvals still record
            advocacy on-chain, but no new reward is minted.
          </p>
        </Card>
      </section>
    </div>
  );
}
