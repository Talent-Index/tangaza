"use client";

import { OrgShell, useOrgAccessContext } from "@/components/org/Shell";
import { Card, ConfigWarning, EmptyState, ErrorNote, SectionTitle, Spinner } from "@/components/ui";
import { addressUrl } from "@/lib/chain";
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
  const { orgId } = useOrgAccessContext();
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
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">Clients</p>
          <p className="tabular mt-1 text-2xl font-bold">{people.length}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">
            Approved weight
          </p>
          <p className="tabular mt-1 text-2xl font-bold">{totalWeight}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">X linked</p>
          <p className="tabular mt-1 text-2xl font-bold">
            {linked}
            <span className="text-base text-mist-500">/{people.length}</span>
          </p>
        </Card>
      </div>

      <section>
        <SectionTitle>Everyone who has engaged</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-[0.14em] text-mist-500">
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Level</th>
                <th className="px-4 py-3 text-right font-semibold">Weight</th>
                <th className="px-4 py-3 text-right font-semibold">Approved</th>
                <th className="px-4 py-3 text-right font-semibold">Pending</th>
                <th className="px-4 py-3 font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const level = levelFor(p.approvedWeight);
                return (
                  <tr key={p.advocate} className="border-b border-ink-800 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {p.displayName ?? advocateName(p.advocate)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-mist-500">
                        <a
                          href={addressUrl(p.advocate)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tabular hover:text-crimson-300"
                        >
                          {shortAddress(p.advocate)} ↗
                        </a>
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
        </Card>
        <p className="mt-3 text-xs text-mist-500">
          A <span className="text-mist-300">·?</span> next to a handle means the person
          typed it themselves and nobody has verified it.
        </p>
      </section>
    </div>
  );
}
