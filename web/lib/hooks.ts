"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useProfiles } from "thirdweb/react";
import { ORG_ID } from "./chain";
import { client, isConfigured } from "./client";
import { advocateName } from "./format";
import { credentialNameFromProfiles } from "./identity";
import {
  loadAdvocateHistory,
  loadOrgLedger,
  type AdvocateHistoryEntry,
  type OrgLedger,
} from "./events";
import { useChainTick } from "./live";
import {
  getAdvocate,
  getCredits,
  getOrg,
  getOutstandingKES,
  getContractOwner,
  getMyCommunities,
  resolveOrgAccess,
  type AdvocateState,
  type Community,
  type CreditState,
  type OrgAccess,
  type OrgState,
} from "./reads";
import type { EngagementType, PendingActivity, PendingStatus } from "./types";

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
 *
 * On top of the poll, every hook listens to the shared chain watcher: the moment the
 * contract emits any event — a submission, an approval, a claim — `useChainTick`
 * bumps and the data refetches immediately. Polling is the fallback; events are why
 * the org dashboard updates without anyone reloading it.
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
  const chainTick = useChainTick();

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
  }, [...deps, nonce, chainTick, enabled]);

  return { data, error, loading, refresh };
}

// Fuji produces a block roughly every 2s. These periods keep the demo feeling live
// without turning the dashboard into an RPC stress test.
const POLL_FAST = 6_000; // advocate-facing state: the moment a credit lands
const POLL_ORG = 10_000; // org totals
const POLL_LEDGER = 20_000; // full event replay — the expensive one
const POLL_QUEUE = 5_000; // local JSON, essentially free

export interface ApplicationSummary {
  id: string;
  name: string;
  emissionCapKes: number;
  approverAddress: string;
  pledge: string;
  status: "draft" | "signed" | "registered" | "rejected";
  orgId?: string;
  registeredTx?: string;
  signedAt?: string;
}

/** The platform's queue of business applications. */
export function useApplications() {
  return useAsync<ApplicationSummary[]>(
    async () => {
      const res = await fetch("/api/applications", { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load applications (${res.status})`);
      return ((await res.json()) as { applications: ApplicationSummary[] }).applications;
    },
    [],
    true,
    POLL_ORG
  );
}

/**
 * This wallet's own business applications, newest first.
 *
 * The business portal needs it to tell an applicant whose org isn't on-chain yet why
 * their queue is empty — previously they were shown the pilot org's dashboard instead,
 * which reads as "your pledge did nothing" at best and somebody else's business at worst.
 *
 * Polled, because registration can land while they're looking at the page.
 */
export function useMyApplications(address?: string) {
  return useAsync<ApplicationSummary[]>(
    async () => {
      const res = await fetch(`/api/applications?approver=${address}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Could not load your application (${res.status})`);
      return ((await res.json()) as { applications: ApplicationSummary[] }).applications;
    },
    [address],
    Boolean(address),
    POLL_ORG
  );
}

/** The contract owner — the only account allowed to register orgs on-chain. */
export function useContractOwner() {
  return useAsync<string>(() => getContractOwner(), [], isConfigured);
}

/** What the connected account may do, resolved from the chain — see resolveOrgAccess. */
export function useOrgAccess(address?: string) {
  return useAsync<OrgAccess>(
    () => resolveOrgAccess(address!, ORG_ID),
    [address],
    isConfigured && Boolean(address)
  );
}

/** Every business this advocate has on-chain standing with. */
export function useMyCommunities(address?: string) {
  return useAsync<Community[]>(
    () => getMyCommunities(address!),
    [address],
    isConfigured && Boolean(address),
    POLL_FAST
  );
}

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

/**
 * The engagements this business has chosen to reward.
 *
 * Not polled: an org edits these from a settings screen every few weeks, not every few
 * seconds, and the submit form re-mounts often enough to stay current.
 */
export function useEngagementTypes(orgId: bigint | undefined = ORG_ID) {
  return useAsync<EngagementType[]>(
    async () => {
      const res = await fetch(`/api/engagement-types?orgId=${orgId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Could not load engagements (${res.status})`);
      const json = (await res.json()) as { types: EngagementType[] };
      return json.types;
    },
    [String(orgId)],
    orgId !== undefined
  );
}

export interface RewardTier {
  id: string;
  level: number;
  name: string;
  perk: string;
  icon: string;
  thresholdWeight: number;
}

export interface LevelStanding {
  approvedWeight: number;
  currentLevel?: number;
  currentLevelName?: string;
  currentPerk?: string;
  nextLevel?: number;
  nextLevelName?: string;
  nextPerk?: string;
  weightToNext?: number;
}

/** The ladder a business offers, and where this person stands on it. */
export function useTiers(address?: string, orgId: bigint = ORG_ID) {
  return useAsync<{ tiers: RewardTier[]; standing?: LevelStanding }>(
    async () => {
      const qs = address ? `?orgId=${orgId}&address=${address}` : `?orgId=${orgId}`;
      const res = await fetch(`/api/tiers${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load levels (${res.status})`);
      return (await res.json()) as { tiers: RewardTier[]; standing?: LevelStanding };
    },
    [address, String(orgId)],
    true,
    POLL_ORG
  );
}

export interface Campaign {
  id: string;
  orgId: string;
  slug: string;
  title: string;
  blurb?: string;
  startsAt: string;
  endsAt?: string;
  active: boolean;
  engagementTypeIds: string[];
  participantCount: number;
}

export interface CampaignWithOrg extends Campaign {
  orgName: string;
}

/** Every live campaign across every business — the advocate's discovery feed. */
export function useAllCampaigns() {
  return useAsync<CampaignWithOrg[]>(
    async () => {
      const res = await fetch("/api/campaigns?all=true", { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load campaigns (${res.status})`);
      return ((await res.json()) as { campaigns: CampaignWithOrg[] }).campaigns;
    },
    [],
    true,
    POLL_ORG
  );
}

export function useCampaigns(orgId: bigint = ORG_ID) {
  return useAsync<Campaign[]>(
    async () => {
      const res = await fetch(`/api/campaigns?orgId=${orgId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load campaigns (${res.status})`);
      return ((await res.json()) as { campaigns: Campaign[] }).campaigns;
    },
    [String(orgId)],
    true
  );
}

/** One campaign by its shareable slug, plus whether this person has joined. */
export function useCampaign(slug: string, address?: string) {
  return useAsync<{ campaign: Campaign; joined: boolean } | null>(
    async () => {
      const qs = address ? `?slug=${slug}&address=${address}` : `?slug=${slug}`;
      const res = await fetch(`/api/campaigns${qs}`, { cache: "no-store" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Could not load campaign (${res.status})`);
      return (await res.json()) as { campaign: Campaign; joined: boolean };
    },
    [slug, address],
    Boolean(slug)
  );
}

export interface DirectoryEntry {
  advocate: string;
  displayName?: string;
  xUsername?: string;
  xLinkStatus?: "claimed" | "verified";
  approvedWeight: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  lastSubmittedAt?: string;
  lastApprovedAt?: string;
  firstSeenAt?: string;
}

/** The business's client list. */
export function useDirectory(orgId: bigint = ORG_ID) {
  return useAsync<DirectoryEntry[]>(
    async () => {
      const res = await fetch(`/api/directory?orgId=${orgId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load clients (${res.status})`);
      return ((await res.json()) as { directory: DirectoryEntry[] }).directory;
    },
    [String(orgId)],
    true,
    POLL_ORG
  );
}

/**
 * One wallet's on-chain story: submissions it recorded, approvals, credits minted,
 * credits burned — every entry a real transaction it can show from any wallet app.
 */
export function useOnChainHistory(address?: string, orgId: bigint = ORG_ID) {
  return useAsync<AdvocateHistoryEntry[]>(
    () => loadAdvocateHistory(address!, orgId),
    [address, String(orgId)],
    isConfigured && Boolean(address),
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
 * Name exposed by the connected login (email local-part / provider name).
 * Never a wallet nickname — those are not credentials.
 */
export function useCredentialName() {
  const { data: profiles } = useProfiles({ client });
  return useMemo(() => credentialNameFromProfiles(profiles), [profiles]);
}

/** Signed-in email from thirdweb, if the login provider exposed one. */
export function useCredentialEmail() {
  const { data: profiles } = useProfiles({ client });
  return useMemo(
    () => profiles?.find((p) => p.details?.email)?.details?.email?.trim() || undefined,
    [profiles]
  );
}

/**
 * The signed-in advocate's own name, from the social account they logged in with.
 *
 * thirdweb's Profile usually carries `details.email` (plus id/phone/address) — there
 * is often no display name, so this falls back to a pretty email local-part
 * ("dan@…" → "Dan"), not "Daniel Mwihoti". It also only ever works for the
 * *connected* wallet: there is no way to ask thirdweb who somebody else's address
 * belongs to. Other people's names come from `useAdvocateLabels` below.
 */
export function useDisplayName(address?: string) {
  const credential = useCredentialName();
  const me = useAdvocateProfile(address);

  // A name they typed beats a handle they linked, beats whatever the social login
  // happened to expose, beats a pseudonym derived from the wallet address.
  if (me.data?.displayName) return me.data.displayName;
  if (me.data?.xUsername) return `@${me.data.xUsername}`;
  if (credential) return credential;

  return address ? advocateName(address) : "";
}

export interface AdvocateProfile {
  address: string;
  displayName?: string;
  xUsername?: string;
  xLinkStatus?: "claimed" | "verified";
}

/** Whatever the advocate has told us about themselves. */
export function useAdvocateProfile(address?: string, orgId: bigint = ORG_ID) {
  return useAsync<AdvocateProfile | null>(
    async () => {
      const res = await fetch(`/api/me?orgId=${orgId}&address=${address}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { profile: AdvocateProfile };
      return json.profile;
    },
    [address, String(orgId)],
    Boolean(address)
  );
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
      // The name they go by now beats whatever label travelled with the submission.
      const label = activity.advocateCurrentName ?? activity.advocateLabel;
      if (label) labels.set(activity.advocate.toLowerCase(), label);
    }
    return labels;
  }, [all.data]);
}
