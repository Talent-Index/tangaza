"use client";

import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { CustomerShell } from "@/components/customer/Shell";
import { SignIn } from "@/components/customer/SignIn";
import { ProgressRing } from "@/components/customer/ProgressRing";
import { Button, Card, ConfigWarning, EmptyState, Pill, SectionTitle, Spinner } from "@/components/ui";
import { MILESTONE_ACTIVITIES, ORG_ID, CREDIT_VALUE_KES } from "@/lib/chain";
import { isConfigured } from "@/lib/client";
import { kesLabel, timeAgo } from "@/lib/format";
import { useAdvocate, useCredits, useOrg, usePendingActivities } from "@/lib/hooks";
import { activityIcon, activityLabel } from "@/lib/types";

export default function Page() {
  const account = useActiveAccount();
  return (
    <CustomerShell>{account ? <Home address={account.address} /> : <Welcome />}</CustomerShell>
  );
}

/* ------------------------------------------------------------------ screen 1 */

function Welcome() {
  return (
    <div className="animate-rise flex flex-col items-center pt-8 text-center">
      <div className="mb-8 grid size-20 place-items-center rounded-3xl bg-crimson-500 text-4xl font-black text-white shadow-[0_20px_60px_-15px_rgb(220_20_60/0.8)]">
        T
      </div>

      <h1 className="text-3xl font-black leading-tight">
        Get paid for the
        <br />
        word you spread.
      </h1>
      <p className="mt-4 max-w-xs text-mist-400">
        Refer a friend, post about us, bring an event. Every 20 approved activities earns
        you {kesLabel(CREDIT_VALUE_KES)} in real rewards.
      </p>

      <div className="mt-10 w-full">
        <SignIn />
      </div>

      <p className="mt-4 text-xs text-mist-500">
        No passwords. No seed phrase. No fees — ever.
      </p>

      <div className="mt-12 grid w-full grid-cols-3 gap-2 text-center">
        {[
          { icon: "👥", label: "Refer" },
          { icon: "𝕏", label: "Post" },
          { icon: "🎤", label: "Host" },
        ].map((item) => (
          <Card key={item.label} className="px-2 py-4">
            <div className="text-xl" aria-hidden>
              {item.icon}
            </div>
            <p className="mt-1 text-xs text-mist-400">{item.label}</p>
          </Card>
        ))}
      </div>

      <Link
        href="/org"
        className="mt-10 text-xs text-mist-500 underline underline-offset-4 hover:text-mist-300"
      >
        I run a business →
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ screen 2 */

function Home({ address }: { address: string }) {
  const org = useOrg();
  const advocate = useAdvocate(address);
  const credits = useCredits(address);
  const pending = usePendingActivities({
    orgId: String(ORG_ID),
    advocate: address,
    status: "pending",
  });

  if (!isConfigured) return <ConfigWarning />;

  if (advocate.loading && !advocate.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  const total = Number(MILESTONE_ACTIVITIES);
  const approved = Number(advocate.data?.approvedActivities ?? 0n);
  const done = approved % total;
  const streak = Number(advocate.data?.streak ?? 0n);
  const available = (credits.data ?? []).filter((c) => !c.redeemed);
  const pendingItems = pending.data ?? [];

  return (
    <div className="animate-rise space-y-6">
      <section className="flex flex-col items-center">
        <p className="mb-4 text-sm text-mist-400">
          {org.data?.name ?? "Your community"}
        </p>
        <ProgressRing done={done} total={total} />

        <div className="mt-5 flex items-center gap-2">
          <Pill tone={streak > 1 ? "warn" : "neutral"}>
            🔥 {streak} day{streak === 1 ? "" : "s"} streak
          </Pill>
          <Pill>{approved} approved all-time</Pill>
        </div>
      </section>

      {available.length > 0 ? (
        <Card className="animate-pop border-crimson-500/40 bg-crimson-500/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-crimson-300">
                {available.length} reward{available.length === 1 ? "" : "s"} ready
              </p>
              <p className="tabular mt-1 text-2xl font-black">
                {kesLabel(available.reduce((sum, c) => sum + Number(c.valueKES), 0))}
              </p>
            </div>
            <Button href="/rewards">Claim</Button>
          </div>
        </Card>
      ) : null}

      <Button href="/submit" className="w-full">
        Submit an activity
      </Button>

      <section>
        <SectionTitle>Waiting for approval</SectionTitle>
        {pending.loading ? (
          <Card className="grid place-items-center py-8">
            <Spinner />
          </Card>
        ) : pendingItems.length === 0 ? (
          <EmptyState
            icon="📮"
            title="Nothing pending"
            body="Submit a referral, a post, or an event you brought in. The Centre approves it and it counts."
          />
        ) : (
          <ul className="space-y-2">
            {pendingItems.map((item) => (
              <li key={item.id}>
                <Card className="flex items-center gap-3 py-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-700 text-lg">
                    {activityIcon(item.activityType)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {activityLabel(item.activityType)}
                    </p>
                    <p className="truncate text-xs text-mist-500">
                      {timeAgo(new Date(item.submittedAt).getTime())}
                    </p>
                  </div>
                  <Pill tone="warn">Pending</Pill>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pt-2 text-center text-[11px] leading-relaxed text-mist-500">
        Rewards come from {org.data?.name ?? "the business"}&rsquo;s fixed budget of{" "}
        {org.data ? kesLabel(org.data.emissionCapKES) : "—"}. That budget can never be
        raised.
      </p>
    </div>
  );
}
