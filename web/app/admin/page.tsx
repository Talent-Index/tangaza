"use client";

import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { BrandMark, Card, ErrorNote, Pill, SectionTitle, Spinner, TxReceipt } from "@/components/ui";
import { kesLabel, shortAddress, timeAgo } from "@/lib/format";
import { useApplications, useContractOwner } from "@/lib/hooks";

/**
 * The platform side: signed applications waiting to become on-chain orgs.
 *
 * This screen exists because a business that signs its pledge at /register was landing
 * in the database and then — from where they stood — vanishing. Registration is
 * deliberately two-step: `registerOrg` is onlyOwner, because registering an org mints
 * the right to issue reward liabilities against a cap nobody can later raise. This is
 * where the platform sees the queue and acts on it.
 *
 * The on-chain call itself stays with the operator's key (a hardhat script), not a
 * button here — the owner key deploys contracts and rotates approvers, and does not
 * belong in a browser. The screen tells the operator exactly what to run.
 */
export default function AdminPage() {
  const account = useActiveAccount();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark />
          <span className="text-sm text-mist-500">Platform</span>
        </Link>
        <Link href="/org" className="text-xs text-mist-500 hover:text-mist-300">
          Business portal →
        </Link>
      </header>

      <main className="flex-1">
        {account ? (
          <Applications viewer={account.address} />
        ) : (
          <Card>
            <p className="mb-4 text-sm text-mist-400">Sign in to view applications.</p>
            <SignIn />
          </Card>
        )}
      </main>
    </div>
  );
}

function Applications({ viewer }: { viewer: string }) {
  const apps = useApplications();
  const owner = useContractOwner();

  const isOwner = owner.data
    ? owner.data.toLowerCase() === viewer.toLowerCase()
    : false;

  if (apps.loading && !apps.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (apps.error) return <ErrorNote>{apps.error}</ErrorNote>;

  const list = apps.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Business applications</h1>
        <p className="mt-1 text-sm text-mist-500">
          Every pledge is wallet-signed by the account that will approve activities.
          Registering it on-chain is the platform&rsquo;s call —{" "}
          {owner.data ? (
            <>
              the contract owner is{" "}
              <code className="tabular text-mist-300">{shortAddress(owner.data)}</code>
              {isOwner ? " (you)" : ""}
            </>
          ) : (
            "loading owner…"
          )}
          .
        </p>
      </div>

      {list.length === 0 ? (
        <Card className="bg-ink-850/60">
          <p className="text-sm text-mist-500">No applications yet.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {a.name}{" "}
                      <span className="text-sm font-normal text-mist-500">
                        · {kesLabel(a.emissionCapKes)} budget
                      </span>
                    </p>
                    <p className="tabular text-xs text-mist-500">
                      approver {shortAddress(a.approverAddress)} ·{" "}
                      {a.signedAt ? `signed ${timeAgo(new Date(a.signedAt).getTime())}` : "unsigned"}
                    </p>
                  </div>
                  <Pill
                    tone={
                      a.status === "registered" ? "good" : a.status === "signed" ? "warn" : "neutral"
                    }
                  >
                    {a.status}
                  </Pill>
                </div>

                <p className="border-l-2 border-ink-600 pl-3 text-sm text-mist-400">
                  {a.pledge}
                </p>

                {a.status === "registered" && a.registeredTx ? (
                  <div className="flex items-center gap-3">
                    <Pill>org #{a.orgId}</Pill>
                    <TxReceipt hash={a.registeredTx} label="Registered on Avalanche" />
                  </div>
                ) : a.status === "signed" ? (
                  <div className="rounded-lg bg-ink-900 p-3">
                    <p className="mb-2 text-xs text-mist-500">
                      To register, the operator runs:
                    </p>
                    <code className="block overflow-x-auto whitespace-pre text-xs text-mist-300">
                      {`ORG_NAME="${a.name}" ORG_APPROVER=${a.approverAddress} ORG_CAP_KES=${a.emissionCapKes} \\\n  npx hardhat run scripts/register-org.ts --network fuji`}
                    </code>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
