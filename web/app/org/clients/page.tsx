"use client";

import { OrgShell, useOrgAccessContext } from "@/components/org/Shell";
import { ConfigWarning, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { addressUrl, txUrl } from "@/lib/chain";
import { isConfigured } from "@/lib/client";
import { advocateName, shortAddress, timeAgo } from "@/lib/format";
import { useDirectory, useTiers } from "@/lib/hooks";

/**
 * The client list.
 *
 * Ranked by approved weight rather than submission count, because weight is what the
 * business actually priced and what the contract actually counted. Someone who brought
 * three people through the door outranks someone who posted ten times, if that is how
 * the business weighted it.
 */
export default function ClientsPage() {
  return (
    <OrgShell>
      <Directory />
    </OrgShell>
  );
}

function Directory() {
  const { orgId, orgName } = useOrgAccessContext();
  const directory = useDirectory(orgId);
  const tiers = useTiers(undefined, orgId);

  if (!isConfigured) return <ConfigWarning />;
  if (directory.error) return <ErrorNote>{directory.error}</ErrorNote>;

  if (directory.loading && !directory.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  const people = directory.data ?? [];
  const ladder = [...(tiers.data?.tiers ?? [])].sort(
    (a, b) => b.thresholdWeight - a.thresholdWeight
  );
  const levelFor = (weight: number) => ladder.find((t) => weight >= t.thresholdWeight);

  if (people.length === 0) {
    return (
      <EmptyState
        icon="👥"
        title="No clients yet"
        body="Anyone who submits an activity appears here, with what they've earned and how to reach them."
      />
    );
  }

  const totalWeight = people.reduce((s, p) => s + p.approvedWeight, 0);
  const linked = people.filter((p) => p.xUsername).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Clients</h1>
        <p className="mt-1 text-sm text-mist-500">
          Everyone who has engaged with {orgName || "you"}. {people.length} people,{" "}
          {totalWeight} approved weight, {linked} with X linked.
        </p>
      </div>

      <div className="border-t border-ink-700" />

      <section className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
              <th className="py-3 pr-4 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 text-right font-medium">Weight</th>
              <th className="px-4 py-3 text-right font-medium">Approved</th>
              <th className="px-4 py-3 text-right font-medium">Pending</th>
              <th className="px-4 py-3 text-left font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const level = levelFor(p.approvedWeight);
              return (
                <tr key={p.advocate} className="border-b border-ink-800 last:border-0">
                    <td className="py-3 pr-4">
                      <div className="font-medium">
                        {p.displayName ?? advocateName(p.advocate)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-mist-500">
                        <a
                          href={addressUrl(p.advocate)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tabular hover:text-crimson-300"
                          title="Wallet address"
                        >
                          {shortAddress(p.advocate)}
                        </a>
                        {p.lastTxHash ? (
                          <a
                            href={txUrl(p.lastTxHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-jade-400 hover:text-jade-300"
                            title="Latest approval on-chain — proof of activity"
                          >
                            proof ↗
                          </a>
                        ) : null}
                        {p.xUsername ? (
                          <a
                            href={`https://x.com/${p.xUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-crimson-300"
                            // Claimed means self-declared and unverified — the business
                            // should know that before it treats the handle as identity.
                            title={
                              p.xLinkStatus === "verified"
                                ? "Verified via X"
                                : "Self-declared, not verified"
                            }
                          >
                            @{p.xUsername}
                            {p.xLinkStatus === "claimed" ? " ·?" : " ✓"}
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-mist-400">
                      {level ? `${level.icon} ${level.name}` : "—"}
                    </td>
                    <td className="tabular px-4 py-3 text-right font-semibold">
                      {p.approvedWeight}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-mist-400">
                      {p.approvedCount}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {p.pendingCount > 0 ? (
                        <span className="text-amber-glow">{p.pendingCount}</span>
                      ) : (
                        <span className="text-mist-500">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-mist-500">
                      {p.lastSubmittedAt
                        ? timeAgo(new Date(p.lastSubmittedAt).getTime())
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        <p className="mt-3 text-xs text-mist-500">
          A <span className="text-mist-300">·?</span> next to a handle means the person
          typed it themselves and nobody has verified it.
        </p>
      </section>
    </div>
  );
}
