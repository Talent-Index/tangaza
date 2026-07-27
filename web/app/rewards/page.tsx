"use client";

import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { CustomerShell } from "@/components/customer/Shell";
import { SignIn } from "@/components/customer/SignIn";
import {
  Button,
  Card,
  ConfigWarning,
  EmptyState,
  ErrorNote,
  Pill,
  SectionTitle,
  Spinner,
} from "@/components/ui";
import { isConfigured } from "@/lib/client";
import { formatDate, kesLabel } from "@/lib/format";
import { useCredits } from "@/lib/hooks";
import { rewardLabel } from "@/lib/types";

/* ------------------------------------------------------------------ screen 4 */

export default function RewardsPage() {
  const account = useActiveAccount();

  return (
    <CustomerShell>
      {account ? (
        <Rewards address={account.address} />
      ) : (
        <div className="pt-16 text-center">
          <p className="mb-6 text-mist-400">Sign in to see your rewards.</p>
          <SignIn />
        </div>
      )}
    </CustomerShell>
  );
}

function Rewards({ address }: { address: string }) {
  const { data, loading, error } = useCredits(address);

  if (!isConfigured) return <ConfigWarning />;

  if (loading && !data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error) return <ErrorNote>{error}</ErrorNote>;

  const credits = data ?? [];
  const available = credits.filter((c) => !c.redeemed);
  const claimed = credits.filter((c) => c.redeemed);
  const availableValue = available.reduce((sum, c) => sum + Number(c.valueKES), 0);

  return (
    <div className="animate-rise space-y-6">
      <section className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
          Ready to claim
        </p>
        <p className="tabular mt-2 text-5xl font-black text-crimson-400">
          {kesLabel(availableValue)}
        </p>
        <p className="mt-2 text-sm text-mist-500">
          {available.length} reward{available.length === 1 ? "" : "s"} · earned by
          advocacy
        </p>
      </section>

      {available.length === 0 ? (
        <EmptyState
          icon="🎁"
          title="No rewards yet"
          body="Every 20 approved activities turns into KES 500. Keep going — you're closer than you think."
          action={<Button href="/submit">Submit an activity</Button>}
        />
      ) : (
        <section>
          <SectionTitle>Yours to claim</SectionTitle>
          <ul className="space-y-3">
            {available.map((credit) => (
              <li key={String(credit.id)}>
                <Link href={`/rewards/${credit.id}`} className="block">
                  <Card className="flex items-center gap-4 border-crimson-500/30 transition hover:border-crimson-500/70">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-crimson-500/15 text-xl">
                      🎁
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="tabular text-lg font-bold">
                        {kesLabel(credit.valueKES)}
                      </p>
                      <p className="text-xs text-mist-500">
                        Earned {formatDate(Number(credit.earnedAt) * 1000)}
                      </p>
                    </div>
                    <span className="text-crimson-300" aria-hidden>
                      →
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {claimed.length > 0 ? (
        <section>
          <SectionTitle>Already claimed</SectionTitle>
          <ul className="space-y-2">
            {claimed.map((credit) => (
              <li key={String(credit.id)}>
                <Card className="flex items-center gap-4 py-4 opacity-70">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-700 text-base">
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="tabular text-sm font-semibold">
                      {kesLabel(credit.valueKES)} {rewardLabel(credit.rewardType)}
                    </p>
                    <p className="text-xs text-mist-500">
                      Claimed {formatDate(Number(credit.redeemedAt) * 1000)}
                    </p>
                  </div>
                  <Pill tone="good">Delivered</Pill>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
