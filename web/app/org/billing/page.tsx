"use client";

import Link from "next/link";
import { OrgShell, useOrgAccessContext } from "@/components/org/Shell";
import { CheckoutPanel, useBilling } from "@/components/org/Checkout";
import { Card, Spinner } from "@/components/ui";

/**
 * The business's billing session: where they stand (free campaigns, credits), buying a
 * credit ahead of needing it, the open checkout if one exists, and every receipt. The
 * same CheckoutPanel that gates campaign creation renders here in "page" mode — one
 * component, so the two surfaces can never quote different numbers.
 */
export default function OrgBillingPage() {
  return (
    <OrgShell>
      <BillingWorkspace />
    </OrgShell>
  );
}

function BillingWorkspace() {
  const { orgId, orgName } = useOrgAccessContext();
  const billing = useBilling(orgId);
  const b = billing.data?.billing;

  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <h1 className="text-2xl font-black md:text-3xl">Billing</h1>
        <p className="mt-1 max-w-2xl text-sm text-mist-500">
          {orgName || "Your business"} pays per campaign, nothing else — see{" "}
          <Link href="/pricing" className="text-mist-300 underline underline-offset-4">
            pricing
          </Link>
          . Payments are matched by reference and exact amount, and every one leaves a
          receipt below.
        </p>
      </header>

      {!b ? (
        <Card className="grid place-items-center py-12">
          <Spinner />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-8">
          <section className="grid min-w-0 grid-cols-2 gap-3">
            <Card className="bg-ink-900/40 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">
                Campaigns created
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{b.campaignsCreated}</p>
            </Card>
            <Card className="bg-ink-900/40 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">
                Free campaigns left
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{b.freeRemaining}</p>
            </Card>
            <Card className="bg-ink-900/40 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">
                Campaign credits
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{b.credits}</p>
            </Card>
            <Card className="bg-ink-900/40 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">
                Your business code
              </p>
              <p className="mt-1 truncate text-2xl font-bold">{b.businessCode}</p>
              <p className="mt-0.5 text-[11px] text-mist-500">
                Every payment reference starts with it
              </p>
            </Card>
          </section>

          <section className="min-w-0">
            <CheckoutPanel
              orgId={orgId}
              billing={b}
              instructions={billing.data?.instructions ?? null}
              onRefresh={billing.refresh}
              mode="page"
            />
          </section>
        </div>
      )}
    </div>
  );
}
