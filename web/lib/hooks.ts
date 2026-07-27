"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useProfiles } from "thirdweb/react";
import { ORG_ID } from "./chain";
import { client, isConfigured } from "./client";
import { advocateName } from "./format";
import { loadOrgLedger, type OrgLedger } from "./events";
import {
  getAdvocate,
  getCredits,
  getOrg,
  getOutstandingKES,
  type AdvocateState,
  type CreditState,
  type OrgState,
} from "./reads";
import type { PendingActivity, PendingStatus } from "./types";

/**
 * Small async-state helper so every panel gets identical loading/error/refresh.
 *
 * `pollMs` is what makes the demo feel live: the org approves on their laptop and the
 * advocate's progress ring ticks up on their phone a few seconds later, with nobody
 * touching reload. Polling pauses while the tab is hidden so a projector left on the
 * overview page doesn't hammer the RPC all afternoon.
 *
 * Previous data is held across a refetch (only `loading` flips), so panels never flash
 * a skeleton or jump the layout mid-demo.
 */
function useAsync<T>(
  load: () => Promise<T>,
  deps: unknown[],
  enabled = true,
  pollMs = 0
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || pollMs <= 0) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      setNonce((n) => n + 1);
    };

    const id = setInterval(tick, pollMs);
    // Catch up immediately when the tab comes back rather than waiting a full period.
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, pollMs]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    load()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  return { data, error, loading, refresh };
}

// Fuji produces a block roughly every 2s. These periods keep the demo feeling live
// without turning the dashboard into an RPC stress test.
const POLL_FAST = 6_000; // advocate-facing state: the moment a credit lands
const POLL_ORG = 10_000; // org totals
const POLL_LEDGER = 20_000; // full event replay — the expensive one
const POLL_QUEUE = 5_000; // local JSON, essentially free

export function useOrg(orgId: bigint = ORG_ID) {
  return useAsync<OrgState>(() => getOrg(orgId), [String(orgId)], isConfigured, POLL_ORG);
}

export function useOutstanding(orgId: bigint = ORG_ID) {
  return useAsync<bigint>(
    () => getOutstandingKES(orgId),
    [String(orgId)],
    isConfigured,
    POLL_ORG
  );
}

export function useAdvocate(address?: string, orgId: bigint = ORG_ID) {
  return useAsync<AdvocateState>(
    () => getAdvocate(orgId, address!),
    [address, String(orgId)],
    isConfigured && Boolean(address),
    POLL_FAST
  );
}

export function useCredits(address?: string) {
  return useAsync<CreditState[]>(
    () => getCredits(address!),
    [address],
    isConfigured && Boolean(address),
    POLL_FAST
  );
}

export function useOrgLedger(orgId: bigint = ORG_ID) {
  return useAsync<OrgLedger>(
    () => loadOrgLedger(orgId),
    [String(orgId)],
    isConfigured,
    POLL_LEDGER
  );
}

/** The off-chain queue. Separate from chain state on purpose. */
export function usePendingActivities(filter: {
  orgId?: string;
  advocate?: string;
  status?: PendingStatus;
}) {
  const params = new URLSearchParams();
  if (filter.orgId) params.set("orgId", filter.orgId);
  if (filter.advocate) params.set("advocate", filter.advocate);
  if (filter.status) params.set("status", filter.status);
  const qs = params.toString();

  return useAsync<PendingActivity[]>(
    async () => {
      const res = await fetch(`/api/activities?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Queue unavailable (${res.status})`);
      const json = (await res.json()) as { activities: PendingActivity[] };
      return json.activities;
    },
    [qs],
    true,
    POLL_QUEUE
  );
}

/**
 * The signed-in advocate's own name, from the social account they logged in with.
 *
 * thirdweb's Profile carries `details.email` (plus id/phone/address) — there is no
 * display name or avatar in it, so this is the email's local part, not "Daniel
 * Mwihoti". It also only ever works for the *connected* wallet: there is no way to
 * ask thirdweb who somebody else's address belongs to. Other people's names come
 * from `useAdvocateLabels` below.
 */
export function useDisplayName(address?: string) {
  const { data: profiles } = useProfiles({ client });

  const email = profiles?.find((p) => p.details?.email)?.details?.email;
  if (email) return email.split("@")[0];
  return address ? advocateName(address) : "";
}

/**
 * address -> display name, for everyone who has ever submitted through the app.
 *
 * The submit form stores the advocate's own name alongside their submission, so the
 * org's leaderboard can show real people instead of address-derived pseudonyms.
 * Seeded demo advocates never submitted anything, so they keep their pseudonyms —
 * which is fine, they aren't real.
 */
export function useAdvocateLabels(orgId: bigint = ORG_ID) {
  const all = usePendingActivities({ orgId: String(orgId) });

  return useMemo(() => {
    const labels = new Map<string, string>();
    for (const activity of all.data ?? []) {
      if (activity.advocateLabel) {
        labels.set(activity.advocate.toLowerCase(), activity.advocateLabel);
      }
    }
    return labels;
  }, [all.data]);
}
