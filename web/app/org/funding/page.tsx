"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { OrgShell, useOrgAccessContext } from "@/components/org/Shell";
import { FundingScreen } from "@/components/payments/FundingScreen";
import { Spinner } from "@/components/ui";

export default function FundingPage() {
  return (
    <Suspense fallback={<OrgShell><div className="grid place-items-center py-24"><Spinner /></div></OrgShell>}>
      <FundingGate />
    </Suspense>
  );
}

function FundingGate() {
  const [testMode, setTestMode] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/mode", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { testMode: true }))
      .then((body: { testMode?: boolean }) => {
        if (!cancelled) setTestMode(body.testMode !== false);
      })
      .catch(() => {
        if (!cancelled) setTestMode(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (testMode === null) {
    return (
      <OrgShell>
        <div className="grid place-items-center py-24">
          <Spinner />
        </div>
      </OrgShell>
    );
  }

  return (
    <OrgShell signedOut={testMode ? <FundingQuery practice /> : undefined}>
      <LiveFunding />
    </OrgShell>
  );
}

function FundingQuery({ practice }: { practice?: boolean }) {
  const params = useSearchParams();
  return (
    <FundingScreen
      practice={practice}
      initialCampaignId={params.get("campaign") ?? undefined}
      initialAmount={params.get("amount") ?? undefined}
    />
  );
}

function LiveFunding() {
  const { orgId } = useOrgAccessContext();
  const params = useSearchParams();
  return (
    <FundingScreen
      orgId={String(orgId)}
      initialCampaignId={params.get("campaign") ?? undefined}
      initialAmount={params.get("amount") ?? undefined}
    />
  );
}
