import "server-only";
import { sql } from "./db";
import type {
  AdvocateXLink,
  CampaignFunnel,
  EngagementType,
  GoalType,
  PendingActivity,
  PendingStatus,
  ProofKind,
  XLinkStatus,
} from "./types";
import { actionsToNextReward, isGoalType, isLocationType, rewardsEarned, type LocationType } from "./types";

/**
 * The off-chain half of Ubu-Tangaza: engagement types a business defines for itself,
 * and the queue of submitted-but-not-yet-approved activity against them.
 *
 * This used to be a JSON file, which was fine locally and impossible on Vercel — the
 * filesystem there is read-only outside /tmp, so every submission 500'd. It is Postgres
 * now. Every caller still goes through the functions below, so the surface to change
 * stayed small; they are async where they used to be synchronous.
 *
 * Proof and rejected submissions stay here. Only the approval goes on-chain.
 */

/* ------------------------------------------------------------------ engagement types */

interface EngagementRow {
  id: string;
  org_id: string;
  label: string;
  blurb: string | null;
  icon: string;
  proof_kind: ProofKind;
  chain_category: number;
  weight: number;
  active: boolean;
  sort_order: number;
}

const toEngagementType = (r: EngagementRow): EngagementType => ({
  id: r.id,
  orgId: String(r.org_id),
  label: r.label,
  blurb: r.blurb ?? undefined,
  icon: r.icon,
  proofKind: r.proof_kind,
  chainCategory: Number(r.chain_category),
  weight: Number(r.weight),
  active: r.active,
  sortOrder: Number(r.sort_order),
});

export async function listEngagementTypes(
  orgId: string,
  opts: { includeInactive?: boolean } = {}
): Promise<EngagementType[]> {
  const rows = opts.includeInactive
    ? await sql`select * from engagement_types where org_id = ${orgId}
                order by sort_order, label`
    : await sql`select * from engagement_types where org_id = ${orgId} and active
                order by sort_order, label`;
  return (rows as EngagementRow[]).map(toEngagementType);
}

export interface UpsertEngagementTypeInput {
  id?: string;
  orgId: string;
  label: string;
  blurb?: string;
  icon?: string;
  proofKind?: ProofKind;
  chainCategory?: number;
  weight?: number;
  active?: boolean;
  sortOrder?: number;
}

export async function upsertEngagementType(
  input: UpsertEngagementTypeInput
): Promise<EngagementType> {
  const {
    id,
    orgId,
    label,
    blurb = null,
    icon = "•",
    proofKind = "link",
    chainCategory = 1,
    weight = 1,
    active = true,
    sortOrder = 0,
  } = input;

  const rows = id
    ? await sql`update engagement_types set
                  label = ${label}, blurb = ${blurb}, icon = ${icon},
                  proof_kind = ${proofKind}::proof_kind,
                  chain_category = ${chainCategory}, weight = ${weight},
                  active = ${active}, sort_order = ${sortOrder}
                where id = ${id} and org_id = ${orgId}
                returning *`
    : await sql`insert into engagement_types
                  (org_id, label, blurb, icon, proof_kind, chain_category, weight, active, sort_order)
                values
                  (${orgId}, ${label}, ${blurb}, ${icon}, ${proofKind}::proof_kind,
                   ${chainCategory}, ${weight}, ${active}, ${sortOrder})
                returning *`;

  return toEngagementType((rows as EngagementRow[])[0]);
}

/** Soft delete: history keeps its denormalised label, so nothing shifts underneath. */
export async function deactivateEngagementType(orgId: string, id: string): Promise<void> {
  await sql`update engagement_types set active = false
            where id = ${id} and org_id = ${orgId}`;
}

/* ------------------------------------------------------------------ submissions */

interface SubmissionRow {
  id: string;
  org_id: string;
  advocate: string;
  advocate_label: string | null;
  current_name: string | null;
  engagement_type_id: string | null;
  campaign_id: string | null;
  type_label: string;
  type_icon: string;
  chain_category: number;
  weight: number;
  proof_url: string | null;
  note: string | null;
  status: PendingStatus;
  tx_hash: string | null;
  submit_tx: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  decided_at: string | null;
}

const toActivity = (r: SubmissionRow): PendingActivity => ({
  id: r.id,
  orgId: String(r.org_id),
  advocate: r.advocate,
  advocateLabel: r.advocate_label ?? undefined,
  advocateCurrentName: r.current_name ?? undefined,
  engagementTypeId: r.engagement_type_id ?? undefined,
  campaignId: r.campaign_id ?? undefined,
  typeLabel: r.type_label,
  typeIcon: r.type_icon,
  activityType: Number(r.chain_category),
  weight: Number(r.weight),
  proofUrl: r.proof_url ?? "",
  note: r.note ?? undefined,
  status: r.status,
  txHash: r.tx_hash ?? undefined,
  submitTx: r.submit_tx ?? undefined,
  rejectionReason: r.rejection_reason ?? undefined,
  submittedAt: new Date(r.submitted_at).toISOString(),
  decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : undefined,
});

export interface CreateActivityInput {
  orgId: string;
  advocate: string;
  advocateLabel?: string;
  engagementTypeId: string;
  proofUrl?: string;
  note?: string;
  campaignId?: string;
  /** The advocate's own on-chain submitActivity transaction. Verified before insert. */
  submitTx?: string;
}

/**
 * The type's label, icon, category and weight are copied onto the submission rather
 * than joined at read time. An org that renames or retires an engagement type must not
 * retroactively rewrite what people already submitted, and `weight` in particular is
 * what the approval will mint against — it has to be pinned at submission time.
 */
export async function createActivity(
  input: CreateActivityInput
): Promise<PendingActivity | undefined> {
  const advocate = input.advocate.toLowerCase();

  const types = (await sql`select * from engagement_types
                           where id = ${input.engagementTypeId} and org_id = ${input.orgId}
                           and active`) as EngagementRow[];
  const type = types[0];
  if (!type) return undefined;

  /**
   * May fill a *missing* display_name from advocateLabel, but never overwrite one.
   *
   * It used to always write from the UI display name — which fell back to a wallet
   * nickname when the social login exposed nothing — so "Wafula" got persisted as
   * though the person had chosen it. The submit form now only sends a stored profile
   * name or a credential-derived name (email → "Dan"), never the nickname, so
   * seeding a null row is safe and stops the business queue showing a pseudonym.
   */
  await sql`insert into advocates (org_id, address)
            values (${input.orgId}, ${advocate})
            on conflict (org_id, address) do update
              set last_active_at = now()`;

  // First contact with a new business inherits the name the person already goes by
  // elsewhere — the standings view resolves names per org, and a null here would
  // present a named person as a pseudonym on this org's leaderboard.
  await sql`update advocates a set display_name = src.display_name
            from (select display_name from advocates
                   where address = ${advocate} and display_name is not null
                   order by last_active_at desc limit 1) src
            where a.org_id = ${input.orgId} and a.address = ${advocate}
              and a.display_name is null`;

  if (input.advocateLabel) {
    await sql`update advocates
              set display_name = ${input.advocateLabel}
              where org_id = ${input.orgId} and address = ${advocate}
                and display_name is null`;
  }

  const rows = await sql`insert into submissions
      (org_id, advocate, advocate_label, engagement_type_id,
       type_label, type_icon, chain_category, weight, proof_url, note,
       campaign_id, submit_tx)
    values
      (${input.orgId}, ${advocate}, ${input.advocateLabel ?? null}, ${type.id},
       ${type.label}, ${type.icon}, ${type.chain_category}, ${type.weight},
       ${input.proofUrl ?? null}, ${input.note ?? null},
       ${input.campaignId ?? null}, ${input.submitTx ?? null})
    returning *`;

  return toActivity((rows as SubmissionRow[])[0]);
}

export async function listActivities(filter: {
  orgId?: string;
  advocate?: string;
  status?: PendingStatus;
}): Promise<PendingActivity[]> {
  const advocate = filter.advocate?.toLowerCase() ?? null;
  /**
   * `current_name` is resolved at read time, across businesses: the name row scoped
   * to this org wins, else the newest name the person set anywhere. Names are per-org
   * in the schema, but people are not — someone who typed their name once, on
   * whichever screen happened to be scoped to whichever org, expects every business
   * to see it. Without the lateral fallback the org page invented a pseudonym for a
   * person who had told us their name.
   */
  const rows = await sql`
    select s.*, coalesce(a_same.display_name, a_any.display_name) as current_name
    from submissions s
    left join advocates a_same
           on a_same.org_id = s.org_id and a_same.address = s.advocate
    left join lateral (
           select display_name from advocates
            where address = s.advocate and display_name is not null
            order by last_active_at desc limit 1
         ) a_any on true
    where (${filter.orgId ?? null}::bigint  is null or s.org_id  = ${filter.orgId ?? null}::bigint)
      and (${advocate}::text                is null or s.advocate = ${advocate}::text)
      and (${filter.status ?? null}::text   is null or s.status   = (${filter.status ?? null})::submission_status)
    order by s.submitted_at desc`;
  return (rows as SubmissionRow[]).map(toActivity);
}

export async function getActivity(id: string): Promise<PendingActivity | undefined> {
  const rows = (await sql`
    select s.*, coalesce(a_same.display_name, a_any.display_name) as current_name
    from submissions s
    left join advocates a_same
           on a_same.org_id = s.org_id and a_same.address = s.advocate
    left join lateral (
           select display_name from advocates
            where address = s.advocate and display_name is not null
            order by last_active_at desc limit 1
         ) a_any on true
    where s.id = ${id}`) as SubmissionRow[];
  return rows[0] ? toActivity(rows[0]) : undefined;
}

export interface DecideActivityInput {
  id: string;
  status: Exclude<PendingStatus, "pending">;
  txHash?: string;
  rejectionReason?: string;
  decidedBy?: string;
}

/**
 * Called after the on-chain approval tx confirms, or when the org rejects.
 *
 * The `status = 'pending'` guard makes this idempotent: a double-click, or a retry
 * after a timeout, cannot decide the same submission twice and mint against the budget
 * a second time. Returns undefined when the id is unknown or already decided.
 */
export async function decideActivity(
  input: DecideActivityInput
): Promise<PendingActivity | undefined> {
  const rows = await sql`
    update submissions set
      status = ${input.status}::submission_status,
      decided_at = now(),
      tx_hash = coalesce(${input.txHash ?? null}, tx_hash),
      rejection_reason = coalesce(${input.rejectionReason ?? null}, rejection_reason),
      decided_by = coalesce(${input.decidedBy?.toLowerCase() ?? null}, decided_by)
    where id = ${input.id} and status = 'pending'
    returning *`;
  return (rows as SubmissionRow[])[0] ? toActivity((rows as SubmissionRow[])[0]) : undefined;
}

/* ------------------------------------------------------------------ CRM */

export interface AdvocateStanding {
  advocate: string;
  displayName?: string;
  approvedWeight: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  lastSubmittedAt?: string;
  lastApprovedAt?: string;
}

/* ------------------------------------------------------------------ social identity */

interface XLinkRow {
  org_id: string;
  address: string;
  x_user_id: string;
  x_username: string;
  status: XLinkStatus;
  linked_at: string;
  verified_at: string | null;
}

const toXLink = (r: XLinkRow): AdvocateXLink => ({
  orgId: String(r.org_id),
  address: r.address,
  xUserId: r.x_user_id,
  xUsername: r.x_username,
  status: r.status,
  linkedAt: new Date(r.linked_at).toISOString(),
  verifiedAt: r.verified_at ? new Date(r.verified_at).toISOString() : undefined,
});

export async function getAdvocateXLink(
  orgId: string,
  address: string
): Promise<AdvocateXLink | undefined> {
  const rows = (await sql`select * from advocate_x_links
                          where org_id = ${orgId} and address = ${address.toLowerCase()}`) as XLinkRow[];
  return rows[0] ? toXLink(rows[0]) : undefined;
}

/**
 * Records the handle an advocate says is theirs.
 *
 * Self-declared, so it lands as 'claimed' and is worth nothing on its own — the point
 * is to have somewhere for OAuth to upgrade later. Until then `x_user_id` is a
 * `manual:` sentinel rather than a real X id, which keeps the one-account-per-business
 * unique constraint meaningful without pretending we verified anything.
 *
 * Returns undefined when that handle is already claimed by a different wallet here.
 */
export async function claimAdvocateXHandle(input: {
  orgId: string;
  address: string;
  handle: string;
  displayName?: string;
}): Promise<AdvocateXLink | undefined> {
  const address = input.address.toLowerCase();
  const handle = input.handle.toLowerCase();

  await sql`insert into advocates (org_id, address, display_name)
            values (${input.orgId}, ${address}, ${input.displayName ?? null})
            on conflict (org_id, address) do update
              set last_active_at = now(),
                  display_name = coalesce(excluded.display_name, advocates.display_name)`;

  try {
    const rows = await sql`
      insert into advocate_x_links (org_id, address, x_user_id, x_username, status)
      values (${input.orgId}, ${address}, ${"manual:" + handle}, ${handle}, 'claimed')
      on conflict (org_id, address) do update
        set x_user_id = excluded.x_user_id,
            x_username = excluded.x_username,
            status = 'claimed',
            verified_at = null,
            linked_at = now()
      returning *`;
    return toXLink((rows as XLinkRow[])[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Someone else already claimed this handle for this business.
    if (message.includes("advocate_x_links_org_id_x_user_id_key")) return undefined;
    throw err;
  }
}

export interface AdvocateProfile {
  address: string;
  displayName?: string;
  xUsername?: string;
  xLinkStatus?: XLinkStatus;
}

/** What an advocate has told us about themselves. */
export async function getAdvocateProfile(
  orgId: string,
  address: string
): Promise<AdvocateProfile> {
  const addr = address.toLowerCase();
  const rows = (await sql`
    select a.display_name, l.x_username, l.status as x_link_status
    from advocates a
    left join advocate_x_links l on l.org_id = a.org_id and l.address = a.address
    where a.org_id = ${orgId} and a.address = ${addr}`) as Array<Record<string, unknown>>;

  const r = rows[0];
  let displayName = (r?.display_name as string) ?? undefined;
  if (!displayName) {
    // The name may have been saved while scoped to a different business — a person
    // has one name, wherever they typed it.
    const any = (await sql`select display_name from advocates
                            where address = ${addr} and display_name is not null
                            order by last_active_at desc limit 1`) as Array<Record<string, unknown>>;
    displayName = (any[0]?.display_name as string) ?? undefined;
  }

  return {
    address: addr,
    displayName,
    xUsername: (r?.x_username as string) ?? undefined,
    xLinkStatus: (r?.x_link_status as XLinkStatus) ?? undefined,
  };
}

/**
 * The name an advocate chose for themselves.
 *
 * Worth being explicit about why this exists: signing in with X gives thirdweb no
 * email and no username, so the app was falling back to a pseudonym derived from the
 * wallet address. Deterministic, but it isn't anybody's name. This lets them say.
 */
export async function setAdvocateDisplayName(
  orgId: string,
  address: string,
  displayName: string | null
): Promise<AdvocateProfile> {
  const addr = address.toLowerCase();
  await sql`insert into advocates (org_id, address, display_name)
            values (${orgId}, ${addr}, ${displayName})
            on conflict (org_id, address) do update
              set display_name = ${displayName}, last_active_at = now()`;
  // A name belongs to the person, not to one business relationship. Setting it (or
  // clearing it) applies to every org that knows this address, so nobody is "Dan" to
  // one business and an address-derived pseudonym to the next.
  await sql`update advocates set display_name = ${displayName}
            where address = ${addr} and org_id != ${orgId}`;
  return getAdvocateProfile(orgId, addr);
}

export async function unlinkAdvocateX(orgId: string, address: string): Promise<void> {
  await sql`delete from advocate_x_links
            where org_id = ${orgId} and address = ${address.toLowerCase()}`;
}

export interface DirectoryEntry {
  advocate: string;
  displayName?: string;
  xUsername?: string;
  xLinkStatus?: XLinkStatus;
  approvedWeight: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  lastSubmittedAt?: string;
  lastApprovedAt?: string;
  firstSeenAt?: string;
  /** The advocate's most recent on-chain approval tx — real proof of their activity. */
  lastTxHash?: string;
}

/** The business's contact list: who they are, what they're worth, how to find them. */
export async function listDirectory(orgId: string, limit = 100): Promise<DirectoryEntry[]> {
  // The directory view is aggregate; pull the latest approved submission's tx per
  // advocate so the UI can link to on-chain proof (the advocate's OWN address is empty —
  // approvals are sent by the org's approver, recorded as contract events).
  const rows = (await sql`
    select d.*, (
      select s.tx_hash from submissions s
      where s.org_id = d.org_id and s.advocate = d.advocate
        and s.status = 'approved' and s.tx_hash is not null
      order by s.decided_at desc nulls last limit 1
    ) as last_tx_hash
    from advocate_directory d
    where d.org_id = ${orgId}
    order by d.approved_weight desc nulls last, d.last_submitted_at desc nulls last
    limit ${limit}`) as Array<Record<string, unknown>>;

  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : undefined);

  return rows.map((r) => ({
    advocate: r.advocate as string,
    displayName: (r.display_name as string) ?? undefined,
    xUsername: (r.x_username as string) ?? undefined,
    xLinkStatus: (r.x_link_status as XLinkStatus) ?? undefined,
    approvedWeight: Number(r.approved_weight ?? 0),
    approvedCount: Number(r.approved_count ?? 0),
    pendingCount: Number(r.pending_count ?? 0),
    rejectedCount: Number(r.rejected_count ?? 0),
    lastSubmittedAt: iso(r.last_submitted_at),
    lastApprovedAt: iso(r.last_approved_at),
    firstSeenAt: iso(r.first_seen_at),
    lastTxHash: (r.last_tx_hash as string) ?? undefined,
  }));
}

/* ------------------------------------------------------------------ levels */

export interface RewardTier {
  id: string;
  orgId: string;
  level: number;
  name: string;
  perk: string;
  icon: string;
  thresholdWeight: number;
  // The off-chain reward this level unlocks — any amount, currency, form. All optional
  // so perk-only levels created before 012 keep working.
  amount?: number;
  currency?: string;
  rewardKind?: string;
  // Per-activity goal (013): when set, this reward is reached by doing a specific
  // engagement `targetCount` times, rather than by total weighted activity.
  engagementTypeId?: string;
  targetCount?: number;
}

const toTier = (r: Record<string, unknown>): RewardTier => ({
  id: r.id as string,
  orgId: String(r.org_id),
  level: Number(r.level),
  name: r.name as string,
  perk: r.perk as string,
  icon: r.icon as string,
  thresholdWeight: Number(r.threshold_weight),
  amount: r.amount == null ? undefined : Number(r.amount),
  currency: (r.currency as string) ?? undefined,
  rewardKind: (r.reward_kind as string) ?? undefined,
  engagementTypeId: (r.engagement_type_id as string) ?? undefined,
  targetCount: r.target_count == null ? undefined : Number(r.target_count),
});

export async function listRewardTiers(orgId: string): Promise<RewardTier[]> {
  const rows = (await sql`select * from reward_tiers where org_id = ${orgId}
                          order by threshold_weight`) as Array<Record<string, unknown>>;
  return rows.map(toTier);
}

export async function upsertRewardTier(input: {
  orgId: string;
  level: number;
  name: string;
  perk: string;
  icon?: string;
  thresholdWeight: number;
  amount?: number | null;
  currency?: string | null;
  rewardKind?: string | null;
  engagementTypeId?: string | null;
  targetCount?: number | null;
}): Promise<RewardTier> {
  const rows = await sql`
    insert into reward_tiers
      (org_id, level, name, perk, icon, threshold_weight, amount, currency, reward_kind,
       engagement_type_id, target_count)
    values (${input.orgId}, ${input.level}, ${input.name}, ${input.perk},
            ${input.icon ?? "★"}, ${input.thresholdWeight},
            ${input.amount ?? null}, ${input.currency ?? null}, ${input.rewardKind ?? null},
            ${input.engagementTypeId ?? null}, ${input.targetCount ?? null})
    on conflict (org_id, level) do update
      set name = excluded.name, perk = excluded.perk, icon = excluded.icon,
          threshold_weight = excluded.threshold_weight,
          amount = excluded.amount, currency = excluded.currency,
          reward_kind = excluded.reward_kind,
          engagement_type_id = excluded.engagement_type_id,
          target_count = excluded.target_count
    returning *`;
  return toTier((rows as Array<Record<string, unknown>>)[0]);
}

/**
 * How many APPROVED submissions of each engagement an advocate has, for measuring
 * per-activity goals ("5 referrals → …"). Keyed off the same approved submissions the
 * on-chain attestation backs. Returns a map of engagementTypeId → approved count.
 */
export async function listAdvocateActivityProgress(
  orgId: string,
  address: string
): Promise<Record<string, number>> {
  const rows = (await sql`
    select engagement_type_id, count(*)::int as approved
    from submissions
    where org_id = ${orgId} and advocate = ${address.toLowerCase()}
      and status = 'approved' and engagement_type_id is not null
    group by engagement_type_id`) as Array<Record<string, unknown>>;
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.engagement_type_id)] = Number(r.approved);
  return out;
}

/** Remove a level. Scoped to the org so an id alone cannot touch another business. */
export async function deleteRewardTier(orgId: string, id: string): Promise<boolean> {
  const rows = (await sql`delete from reward_tiers
                          where id = ${id} and org_id = ${orgId}
                          returning id`) as Array<Record<string, unknown>>;
  return rows.length > 0;
}

export interface AdvocateLevel {
  approvedWeight: number;
  currentLevel?: number;
  currentLevelName?: string;
  currentPerk?: string;
  nextLevel?: number;
  nextLevelName?: string;
  nextPerk?: string;
  weightToNext?: number;
}

/** Where one person stands against their business's levels. */
export async function getAdvocateLevel(
  orgId: string,
  address: string
): Promise<AdvocateLevel> {
  const rows = (await sql`select * from advocate_levels
                          where org_id = ${orgId} and advocate = ${address.toLowerCase()}`) as Array<
    Record<string, unknown>
  >;
  const r = rows[0];
  const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
  return {
    approvedWeight: Number(r?.approved_weight ?? 0),
    currentLevel: num(r?.current_level),
    currentLevelName: (r?.current_level_name as string) ?? undefined,
    currentPerk: (r?.current_perk as string) ?? undefined,
    nextLevel: num(r?.next_level),
    nextLevelName: (r?.next_level_name as string) ?? undefined,
    nextPerk: (r?.next_perk as string) ?? undefined,
    weightToNext: num(r?.weight_to_next),
  };
}

/* --------------------------------------------------------------- campaigns */

export interface Campaign {
  id: string;
  orgId: string;
  slug: string;
  title: string;
  blurb?: string;
  coverUrl?: string;
  startsAt: string;
  endsAt?: string;
  active: boolean;
  engagementTypeIds: string[];
  participantCount: number;
  /** What the business wants to achieve. All optional — a campaign without one works as before. */
  goalType?: GoalType;
  /** How many approved actions it is aiming for. */
  goalTarget?: number;
  /** What is counted, e.g. "sign-ups". Absent means "approved actions". */
  goalLabel?: string;
  offerName?: string;
  offerUrl?: string;
  /** Submissions under this campaign the business has approved — the only thing "progress" means. */
  approvedCount: number;
  /** Submissions still waiting on the business. */
  pendingCount: number;
  /** "campaign" (the default) or "referral" — a referral is created from the Referrals page. */
  kind: CampaignKind;
  /** What one person earns: its form, amount and currency. All optional. */
  rewardKind?: string;
  rewardAmount?: number;
  rewardCurrency?: string;
  rewardNote?: string;
  /** Approved actions one person needs under this campaign to earn the reward. */
  rewardThreshold?: number;
  /** Earn again every `rewardThreshold` approved actions, rather than once. */
  rewardRepeats: boolean;
}

export type CampaignKind = "campaign" | "referral";

const toCampaign = (r: Record<string, unknown>): Campaign => ({
  id: r.id as string,
  orgId: String(r.org_id),
  slug: r.slug as string,
  title: r.title as string,
  blurb: (r.blurb as string) ?? undefined,
  coverUrl: (r.cover_url as string) ?? undefined,
  startsAt: new Date(r.starts_at as string).toISOString(),
  endsAt: r.ends_at ? new Date(r.ends_at as string).toISOString() : undefined,
  active: Boolean(r.active),
  engagementTypeIds: (r.engagement_type_ids as string[]) ?? [],
  participantCount: Number(r.participant_count ?? 0),
  // goal_* are absent from c.* until the goals migration (db/017) has been applied.
  goalType: isGoalType(r.goal_type) ? r.goal_type : undefined,
  goalTarget: r.goal_target != null ? Number(r.goal_target) : undefined,
  goalLabel: (r.goal_label as string) || undefined,
  offerName: (r.offer_name as string) || undefined,
  offerUrl: (r.offer_url as string) || undefined,
  approvedCount: Number(r.approved_count ?? 0),
  pendingCount: Number(r.pending_count ?? 0),
  // kind/reward_* are absent from c.* until db/019 has been applied.
  kind: r.kind === "referral" ? "referral" : "campaign",
  rewardKind: (r.reward_kind as string) || undefined,
  rewardAmount: r.reward_amount != null ? Number(r.reward_amount) : undefined,
  rewardCurrency: (r.reward_currency as string) || undefined,
  rewardNote: (r.reward_note as string) || undefined,
  rewardThreshold: r.reward_threshold != null ? Number(r.reward_threshold) : undefined,
  rewardRepeats: Boolean(r.reward_repeats),
});

/**
 * Goal columns on `campaigns` (db/017_campaign_goals.sql). Migrations here are applied
 * by hand on production, so the first campaign read/write checks for them and adds them
 * if missing. If even that fails (no DDL rights) we run in "no goal columns" mode:
 * reads ignore them, writes omit them, and the API reports goalsAvailable: false.
 * `true` is cached for the life of the process; `false` is retried after a minute.
 */
const GOAL_COLUMN_COUNT = 5;
let goalsReady: Promise<boolean> | null = null;
let goalsCheckedFalseAt = 0;

export function goalColumnsAvailable(): Promise<boolean> {
  if (goalsReady && goalsCheckedFalseAt && Date.now() - goalsCheckedFalseAt > 60_000) {
    goalsReady = null;
    goalsCheckedFalseAt = 0;
  }
  goalsReady ??= (async () => {
    try {
      const have = (await sql`
        select column_name from information_schema.columns
        where table_schema = current_schema() and table_name = 'campaigns'
          and column_name in ('goal_type', 'goal_target', 'goal_label', 'offer_name', 'offer_url')`) as Array<{ column_name: string }>;
      if (have.length < GOAL_COLUMN_COUNT) {
        await sql`
          alter table campaigns
            add column if not exists goal_type   text,
            add column if not exists goal_target integer,
            add column if not exists goal_label  text,
            add column if not exists offer_name  text,
            add column if not exists offer_url   text`;
      }
      return true;
    } catch (err) {
      console.warn("[campaigns] goal columns unavailable, running without goals:", err);
      goalsCheckedFalseAt = Date.now();
      return false;
    }
  })();
  return goalsReady;
}

/**
 * Business profile, campaign rewards, referrals and the rewards-given ledger
 * (db/019_business_profile_and_campaign_rewards.sql), applied lazily like the goal
 * columns above. `false` means the database refused the DDL: registration then stores
 * only what it always did, and campaigns run without rewards.
 */
let draftReady: Promise<boolean> | null = null;
let draftCheckedFalseAt = 0;

export function rewardColumnsAvailable(): Promise<boolean> {
  if (draftReady && draftCheckedFalseAt && Date.now() - draftCheckedFalseAt > 60_000) {
    draftReady = null;
    draftCheckedFalseAt = 0;
  }
  draftReady ??= (async () => {
    try {
      const have = (await sql`
        select 1 from information_schema.tables
        where table_schema = current_schema() and table_name = 'campaign_rewards'`) as unknown[];
      if (have.length === 0) {
        await sql`
          alter table org_applications
            add column if not exists location_type    text,
            add column if not exists address          text,
            add column if not exists social_x         text,
            add column if not exists social_tiktok    text,
            add column if not exists social_instagram text`;
        await sql`
          alter table orgs
            add column if not exists contact_email    text,
            add column if not exists contact_phone    text,
            add column if not exists location_type    text,
            add column if not exists address          text,
            add column if not exists social_x         text,
            add column if not exists social_tiktok    text,
            add column if not exists social_instagram text`;
        await sql`
          alter table campaigns
            add column if not exists kind             text not null default 'campaign',
            add column if not exists reward_kind      text,
            add column if not exists reward_amount    numeric,
            add column if not exists reward_currency  text,
            add column if not exists reward_note      text,
            add column if not exists reward_threshold integer,
            add column if not exists reward_repeats   boolean not null default false`;
        await sql`
          create table if not exists campaign_rewards (
            campaign_id   uuid    not null references campaigns(id) on delete cascade,
            org_id        bigint  not null references orgs(id) on delete cascade,
            advocate      text    not null,
            given_count   integer not null default 0 check (given_count >= 0),
            last_given_at timestamptz,
            last_given_by text,
            primary key (campaign_id, advocate)
          )`;
        await sql`create index if not exists campaign_rewards_org_idx on campaign_rewards (org_id)`;
      }
      return true;
    } catch (err) {
      console.warn("[campaigns] reward columns unavailable, running without rewards:", err);
      draftCheckedFalseAt = Date.now();
      return false;
    }
  })();
  return draftReady;
}

/*
 * Approved/pending counts per campaign are aggregated in a derived table and joined 1:1
 * (max() in the outer select just picks that single row) — joining submissions straight
 * in beside the participant/engagement joins would fan the counts out.
 */

export async function listCampaigns(orgId: string): Promise<Campaign[]> {
  await goalColumnsAvailable(); // make sure the editor can offer goals; reads work either way
  await rewardColumnsAvailable();
  const rows = (await sql`
    select c.*,
      coalesce(array_agg(distinct ce.engagement_type_id)
        filter (where ce.engagement_type_id is not null), '{}') as engagement_type_ids,
      count(distinct p.address) as participant_count,
      coalesce(max(sc.approved_n), 0) as approved_count,
      coalesce(max(sc.pending_n), 0) as pending_count
    from campaigns c
    left join campaign_engagements ce on ce.campaign_id = c.id
    left join campaign_participants p on p.campaign_id = c.id
    left join (
      select campaign_id,
        count(*) filter (where status = 'approved') as approved_n,
        count(*) filter (where status = 'pending') as pending_n
      from submissions
      where campaign_id is not null and status in ('approved', 'pending') and org_id = ${orgId}
      group by campaign_id
    ) sc on sc.campaign_id = c.id
    where c.org_id = ${orgId}
    group by c.id
    order by c.active desc, c.starts_at desc`) as Array<Record<string, unknown>>;
  return rows.map(toCampaign);
}

export async function getCampaignBySlug(slug: string): Promise<CampaignWithOrg | undefined> {
  const rows = (await sql`
    select c.*, coalesce(nullif(o.display_name, ''), o.name) as org_name,
      coalesce(array_agg(distinct ce.engagement_type_id)
        filter (where ce.engagement_type_id is not null), '{}') as engagement_type_ids,
      count(distinct p.address) as participant_count,
      coalesce(max(sc.approved_n), 0) as approved_count,
      coalesce(max(sc.pending_n), 0) as pending_count
    from campaigns c
    join orgs o on o.id = c.org_id
    left join campaign_engagements ce on ce.campaign_id = c.id
    left join campaign_participants p on p.campaign_id = c.id
    left join (
      select campaign_id,
        count(*) filter (where status = 'approved') as approved_n,
        count(*) filter (where status = 'pending') as pending_n
      from submissions
      where campaign_id is not null and status in ('approved', 'pending') and campaign_id = (select id from campaigns where slug = ${slug})
      group by campaign_id
    ) sc on sc.campaign_id = c.id
    where c.slug = ${slug}
    group by c.id, o.name, o.display_name`) as Array<Record<string, unknown>>;
  return rows[0] ? { ...toCampaign(rows[0]), orgName: rows[0].org_name as string } : undefined;
}

export interface CampaignActivity {
  advocate: string;
  name?: string;
  typeLabel: string;
  typeIcon: string;
  weight: number;
  status: string;
  submittedAt: string;
  /** The on-chain approval tx — proof of this activity. Only set once approved. */
  txHash?: string;
}

/** Every activity logged under a campaign — what people actually did, newest first. */
export async function listCampaignActivity(
  campaignId: string,
  limit = 50
): Promise<CampaignActivity[]> {
  const rows = (await sql`
    select advocate, advocate_label, current_name, type_label, type_icon, weight, status,
           tx_hash, submitted_at
    from submissions
    where campaign_id = ${campaignId}
    order by submitted_at desc
    limit ${limit}`) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    advocate: r.advocate as string,
    name: (r.current_name as string) ?? (r.advocate_label as string) ?? undefined,
    typeLabel: r.type_label as string,
    typeIcon: r.type_icon as string,
    weight: Number(r.weight ?? 0),
    status: r.status as string,
    submittedAt: new Date(r.submitted_at as string).toISOString(),
    txHash: (r.tx_hash as string) ?? undefined,
  }));
}

/** Joining is free and reversible — it only scopes what you see, never what you earn. */
export async function joinCampaign(
  campaignId: string,
  orgId: string,
  address: string,
  referredBy?: string
): Promise<boolean> {
  const joiner = address.toLowerCase();
  // Sharing your own link to yourself is not a referral.
  const referrer =
    referredBy && referredBy.toLowerCase() !== joiner ? referredBy.toLowerCase() : null;

  const rows = await sql`
    insert into campaign_participants (campaign_id, org_id, address, referred_by)
    values (${campaignId}, ${orgId}, ${joiner}, ${referrer})
    on conflict (campaign_id, address) do nothing
    returning campaign_id`;
  const joinedNow = (rows as unknown[]).length > 0;

  // Credit the sharer only when the join actually happened — a re-click on an
  // already-joined account must not inflate anyone's tally.
  if (joinedNow && referrer) {
    await sql`update campaign_shares set join_count = join_count + 1
              where campaign_id = ${campaignId} and sharer = ${referrer}`;
  }
  return joinedNow;
}

/* ------------------------------------------------------------ share links */

export interface ShareLink {
  code: string;
  clickCount: number;
  joinCount: number;
}

/**
 * One personal share link per person per campaign. The code is opaque on purpose —
 * short enough for an X post, revealing nothing about who is behind it until the
 * business looks at its own tally.
 */
export async function getOrCreateShareLink(
  slug: string,
  sharer: string
): Promise<ShareLink | undefined> {
  const campaign = await getCampaignBySlug(slug);
  if (!campaign) return undefined;
  const who = sharer.toLowerCase();

  const existing = (await sql`
    select code, click_count, join_count from campaign_shares
    where campaign_id = ${campaign.id} and sharer = ${who}`) as Array<Record<string, unknown>>;
  if (existing[0]) {
    return {
      code: existing[0].code as string,
      clickCount: Number(existing[0].click_count),
      joinCount: Number(existing[0].join_count),
    };
  }

  // 8 chars of base36 from a uuid: compact, unguessable enough, retried on the
  // vanishing chance of a collision — the same posture as campaign slug minting.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const rows = (await sql`
        insert into campaign_shares (campaign_id, org_id, sharer, code)
        values (${campaign.id}, ${campaign.orgId}, ${who},
                upper(substr(md5(gen_random_uuid()::text), 1, 8)))
        on conflict (code) do nothing
        returning code`) as Array<Record<string, unknown>>;
      if (rows[0]) return { code: rows[0].code as string, clickCount: 0, joinCount: 0 };
      // code collided — loop and mint a different one.
    } catch {
      // Two first-time calls raced past the pre-select and hit the
      // (campaign_id, sharer) unique — whoever won holds the answer.
      const raced = (await sql`
        select code, click_count, join_count from campaign_shares
        where campaign_id = ${campaign.id} and sharer = ${who}`) as Array<
        Record<string, unknown>
      >;
      if (raced[0]) {
        return {
          code: raced[0].code as string,
          clickCount: Number(raced[0].click_count),
          joinCount: Number(raced[0].join_count),
        };
      }
      throw new Error("Could not mint a share code");
    }
  }
  throw new Error("Could not mint a share code");
}

/** Resolves a /s/<code> hit and counts the click in the same statement. */
export async function resolveShareCode(
  code: string
): Promise<{ slug: string; sharer: string } | undefined> {
  const rows = (await sql`
    update campaign_shares set click_count = click_count + 1
    where code = ${code.toUpperCase()}
    returning sharer, (select slug from campaigns where id = campaign_id) as slug`) as Array<
    Record<string, unknown>
  >;
  if (!rows[0]) return undefined;
  return { slug: rows[0].slug as string, sharer: rows[0].sharer as string };
}

/** Looks up who a code belongs to without counting a click (used at join time). */
export async function peekShareCode(
  code: string
): Promise<{ sharer: string } | undefined> {
  const rows = (await sql`select sharer from campaign_shares
                          where code = ${code.toUpperCase()}`) as Array<Record<string, unknown>>;
  return rows[0] ? { sharer: rows[0].sharer as string } : undefined;
}

export interface CampaignSharer {
  sharer: string;
  displayName?: string;
  code: string;
  clickCount: number;
  joinCount: number;
}

/** Who is spreading a campaign, best first — the business's word-of-mouth view. */
export async function listCampaignShares(campaignId: string): Promise<CampaignSharer[]> {
  const rows = (await sql`
    select s.sharer, s.code, s.click_count, s.join_count, a.display_name
    from campaign_shares s
    left join advocates a on a.org_id = s.org_id and a.address = s.sharer
    where s.campaign_id = ${campaignId}
    order by s.join_count desc, s.click_count desc
    limit 20`) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    sharer: r.sharer as string,
    displayName: (r.display_name as string) ?? undefined,
    code: r.code as string,
    clickCount: Number(r.click_count),
    joinCount: Number(r.join_count),
  }));
}

export async function hasJoinedCampaign(
  campaignId: string,
  address: string
): Promise<boolean> {
  const rows = (await sql`select 1 from campaign_participants
                          where campaign_id = ${campaignId}
                            and address = ${address.toLowerCase()}`) as unknown[];
  return rows.length > 0;
}

/** Leaderboard, ranked by the weight the contract actually counted. */
export async function listStandings(
  orgId: string,
  limit = 50
): Promise<AdvocateStanding[]> {
  const rows = (await sql`
    select * from advocate_standings
    where org_id = ${orgId}
    order by approved_weight desc nulls last, last_approved_at desc nulls last
    limit ${limit}`) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    advocate: r.advocate as string,
    displayName: (r.display_name as string) ?? undefined,
    approvedWeight: Number(r.approved_weight ?? 0),
    approvedCount: Number(r.approved_count ?? 0),
    pendingCount: Number(r.pending_count ?? 0),
    rejectedCount: Number(r.rejected_count ?? 0),
    lastSubmittedAt: r.last_submitted_at
      ? new Date(r.last_submitted_at as string).toISOString()
      : undefined,
    lastApprovedAt: r.last_approved_at
      ? new Date(r.last_approved_at as string).toISOString()
      : undefined,
  }));
}

/* --------------------------------------------------------------- registration */

export type ApplicationStatus = "draft" | "signed" | "registered" | "rejected";

export interface BusinessContact {
  contactEmail?: string;
  contactPhone?: string;
  locationType?: LocationType;
  /** A street address for a physical business, a web link for an online one. */
  address?: string;
  socialX?: string;
  socialTiktok?: string;
  socialInstagram?: string;
}

const toContact = (r: Record<string, unknown> | undefined): BusinessContact => ({
  contactEmail: (r?.contact_email as string) || undefined,
  contactPhone: (r?.contact_phone as string) || undefined,
  locationType: isLocationType(r?.location_type) ? r.location_type : undefined,
  address: (r?.address as string) || undefined,
  socialX: (r?.social_x as string) || undefined,
  socialTiktok: (r?.social_tiktok as string) || undefined,
  socialInstagram: (r?.social_instagram as string) || undefined,
});

export interface OrgApplication extends BusinessContact {
  id: string;
  name: string;
  approverAddress: string;
  emissionCapKes: number;
  pledge: string;
  signature?: string;
  signedAt?: string;
  status: ApplicationStatus;
  orgId?: string;
  registeredTx?: string;
  createdAt: string;
}

const toApplication = (r: Record<string, unknown>): OrgApplication => ({
  ...toContact(r),
  id: r.id as string,
  name: r.name as string,
  approverAddress: r.approver_address as string,
  emissionCapKes: Number(r.emission_cap_kes),
  pledge: r.pledge as string,
  signature: (r.signature as string) ?? undefined,
  signedAt: r.signed_at ? new Date(r.signed_at as string).toISOString() : undefined,
  status: r.status as ApplicationStatus,
  orgId: r.org_id ? String(r.org_id) : undefined,
  registeredTx: (r.registered_tx as string) ?? undefined,
  createdAt: new Date(r.created_at as string).toISOString(),
});

/**
 * A business applying to run rewards, with the pledge already signed.
 *
 * Stored as 'signed' rather than 'registered' because registering mints the right to
 * issue reward liabilities, and registerOrg is onlyOwner for that reason. The platform
 * makes the on-chain call; this is the queue it works from.
 */
export async function createApplication(input: BusinessContact & {
  name: string;
  approverAddress: string;
  emissionCapKes: number;
  pledge: string;
  signature: string;
  signedMessage: string;
}): Promise<OrgApplication> {
  const rows = (await sql`
    insert into org_applications
      (name, contact_email, contact_phone, approver_address, emission_cap_kes, pledge,
       signature, signed_message, signed_at, status)
    values
      (${input.name}, ${input.contactEmail ?? null}, ${input.contactPhone ?? null},
       ${input.approverAddress.toLowerCase()},
       ${input.emissionCapKes}, ${input.pledge}, ${input.signature},
       ${input.signedMessage}, now(), 'signed')
    returning *`) as Array<Record<string, unknown>>;

  // The rest of the contact details live in columns db/019 adds. Without them the
  // application still files; only those details are dropped.
  if (await rewardColumnsAvailable()) {
    const updated = (await sql`
      update org_applications set
        location_type = ${input.locationType ?? null}, address = ${input.address ?? null},
        social_x = ${input.socialX ?? null}, social_tiktok = ${input.socialTiktok ?? null},
        social_instagram = ${input.socialInstagram ?? null}
      where id = ${rows[0].id as string}
      returning *`) as Array<Record<string, unknown>>;
    return toApplication(updated[0]);
  }
  return toApplication(rows[0]);
}

export async function listApplications(
  status?: ApplicationStatus
): Promise<OrgApplication[]> {
  const rows = status
    ? await sql`select * from org_applications where status = ${status}::application_status
                order by created_at desc`
    : await sql`select * from org_applications order by created_at desc`;
  return (rows as Array<Record<string, unknown>>).map(toApplication);
}

/**
 * The applications a particular wallet signed.
 *
 * Scoped by approver on purpose: the business portal needs to tell one applicant "yours
 * is still being registered", and it must not do that by shipping every other
 * business's pledge to the browser.
 */
export async function listApplicationsForApprover(
  approverAddress: string
): Promise<OrgApplication[]> {
  const rows = (await sql`select * from org_applications
                           where lower(approver_address) = ${approverAddress.toLowerCase()}
                           order by created_at desc`) as Array<Record<string, unknown>>;
  return rows.map(toApplication);
}

export async function getApplication(id: string): Promise<OrgApplication | undefined> {
  const rows = (await sql`select * from org_applications where id = ${id}`) as Array<
    Record<string, unknown>
  >;
  return rows[0] ? toApplication(rows[0]) : undefined;
}

/**
 * How to reach a business. Prefers what is on the orgs row; falls back to the newest
 * application registered as this org, which covers businesses registered by the admin
 * script rather than through markApplicationRegistered.
 */
export async function getOrgContact(orgId: string): Promise<BusinessContact> {
  if (!(await rewardColumnsAvailable())) return {};
  const rows = (await sql`
    select coalesce(o.contact_email, a.contact_email)       as contact_email,
           coalesce(o.contact_phone, a.contact_phone)       as contact_phone,
           coalesce(o.location_type, a.location_type)       as location_type,
           coalesce(o.address, a.address)                   as address,
           coalesce(o.social_x, a.social_x)                 as social_x,
           coalesce(o.social_tiktok, a.social_tiktok)       as social_tiktok,
           coalesce(o.social_instagram, a.social_instagram) as social_instagram
    from (select ${orgId}::bigint as id) k
    left join orgs o on o.id = k.id
    left join lateral (
      select * from org_applications
      where org_id = k.id order by created_at desc limit 1
    ) a on true`) as Array<Record<string, unknown>>;
  return toContact(rows[0]);
}

/** The editable display name a business set, if any. Null falls back to the on-chain name. */
export async function getOrgDisplayName(orgId: string): Promise<string | null> {
  const rows = (await sql`select display_name from orgs where id = ${orgId}`) as Array<
    Record<string, unknown>
  >;
  const name = rows[0]?.display_name;
  return name ? String(name) : null;
}

/**
 * Set (or clear, with null) a business's editable display name. Upserts the orgs row so
 * it works even for the seeded pilot org, which has no orgs row until someone writes one.
 */
export async function setOrgDisplayName(orgId: string, name: string | null): Promise<void> {
  await sql`insert into orgs (id, name, display_name)
            values (${orgId}, ${name ?? ""}, ${name})
            on conflict (id) do update set display_name = excluded.display_name`;
}

/* ------------------------------------------------- M-Pesa referral pilot (C2B) */

/** A share code → its referrer + org, with NO click side-effect (unlike resolveShareCode). */
export async function resolveReferralCode(
  code: string
): Promise<{ sharer: string; orgId: string; campaignId: string } | undefined> {
  const rows = (await sql`
    select sharer, org_id, campaign_id from campaign_shares
    where code = ${code.trim().toUpperCase()}`) as Array<Record<string, unknown>>;
  const r = rows[0];
  return r
    ? { sharer: String(r.sharer), orgId: String(r.org_id), campaignId: String(r.campaign_id) }
    : undefined;
}

/** Which merchant a Till/shortcode belongs to. */
export async function getOrgByShortcode(shortcode: string): Promise<string | undefined> {
  const rows = (await sql`select id from orgs where till_shortcode = ${shortcode}`) as Array<
    Record<string, unknown>
  >;
  return rows[0] ? String(rows[0].id) : undefined;
}

export interface OrgMpesaConfig {
  tillShortcode?: string;
  rewardAmount?: number;
  rewardCurrency?: string;
  rewardKind?: string;
}

export async function getOrgMpesaConfig(orgId: string): Promise<OrgMpesaConfig> {
  const rows = (await sql`
    select till_shortcode, referral_reward_amount, referral_reward_currency, referral_reward_kind
    from orgs where id = ${orgId}`) as Array<Record<string, unknown>>;
  const r = rows[0];
  return {
    tillShortcode: (r?.till_shortcode as string) ?? undefined,
    rewardAmount: r?.referral_reward_amount == null ? undefined : Number(r.referral_reward_amount),
    rewardCurrency: (r?.referral_reward_currency as string) ?? undefined,
    rewardKind: (r?.referral_reward_kind as string) ?? undefined,
  };
}

export async function setOrgMpesaConfig(orgId: string, cfg: OrgMpesaConfig): Promise<void> {
  await sql`
    insert into orgs (id, name, till_shortcode, referral_reward_amount,
                      referral_reward_currency, referral_reward_kind)
    values (${orgId}, '', ${cfg.tillShortcode ?? null}, ${cfg.rewardAmount ?? null},
            ${cfg.rewardCurrency ?? null}, ${cfg.rewardKind ?? null})
    on conflict (id) do update set
      till_shortcode = excluded.till_shortcode,
      referral_reward_amount = excluded.referral_reward_amount,
      referral_reward_currency = excluded.referral_reward_currency,
      referral_reward_kind = excluded.referral_reward_kind`;
}

export interface MpesaPayment {
  id: string;
  transId: string;
  shortcode: string;
  orgId?: string;
  amount: number;
  msisdn?: string;
  firstName?: string;
  billRef?: string;
  referralCode?: string;
  referrer?: string;
  verified: boolean;
  createdAt: string;
}

const toPayment = (r: Record<string, unknown>): MpesaPayment => ({
  id: r.id as string,
  transId: r.trans_id as string,
  shortcode: r.shortcode as string,
  orgId: r.org_id == null ? undefined : String(r.org_id),
  amount: Number(r.amount ?? 0),
  msisdn: (r.msisdn as string) ?? undefined,
  firstName: (r.first_name as string) ?? undefined,
  billRef: (r.bill_ref as string) ?? undefined,
  referralCode: (r.referral_code as string) ?? undefined,
  referrer: (r.referrer as string) ?? undefined,
  verified: Boolean(r.verified),
  createdAt: new Date(r.created_at as string).toISOString(),
});

/**
 * Record a C2B confirmation, idempotent on Daraja's TransID (retried callbacks are
 * no-ops). Matches the typed account/reference to a referral code → referrer; a match
 * marks the payment a VERIFIED referred purchase. Resolves the merchant from the code's
 * org, falling back to the Till/shortcode.
 */
export async function recordMpesaPayment(input: {
  transId: string;
  shortcode: string;
  amount: number;
  msisdn?: string;
  firstName?: string;
  billRef?: string;
}): Promise<MpesaPayment> {
  const code = input.billRef?.trim().toUpperCase() || null;
  const referral = code ? await resolveReferralCode(code) : undefined;
  const orgId = referral?.orgId ?? (await getOrgByShortcode(input.shortcode));

  const rows = (await sql`
    insert into mpesa_payments
      (trans_id, shortcode, org_id, amount, msisdn, first_name, bill_ref, referral_code,
       referrer, verified)
    values (${input.transId}, ${input.shortcode}, ${orgId ?? null}, ${input.amount},
            ${input.msisdn ?? null}, ${input.firstName ?? null}, ${input.billRef ?? null},
            ${referral ? code : null}, ${referral?.sharer ?? null}, ${Boolean(referral)})
    on conflict (trans_id) do nothing
    returning *`) as Array<Record<string, unknown>>;

  if (rows[0]) return toPayment(rows[0]);
  // Already recorded (idempotent replay): return the stored row.
  const existing = (await sql`
    select * from mpesa_payments where trans_id = ${input.transId}`) as Array<
    Record<string, unknown>
  >;
  return toPayment(existing[0]);
}

/** Verified referred purchases for a merchant, newest first — the "who's owed" list. */
export async function listReferredPurchases(orgId: string, limit = 100): Promise<MpesaPayment[]> {
  const rows = (await sql`
    select * from mpesa_payments
    where org_id = ${orgId} and verified = true
    order by created_at desc limit ${limit}`) as Array<Record<string, unknown>>;
  return rows.map(toPayment);
}

/** Pilot metric: verified referred purchases vs total payments seen for a merchant. */
export async function countMpesaReferrals(
  orgId: string
): Promise<{ verified: number; total: number }> {
  const rows = (await sql`
    select count(*) filter (where verified)::int as verified, count(*)::int as total
    from mpesa_payments where org_id = ${orgId}`) as Array<Record<string, unknown>>;
  return { verified: Number(rows[0]?.verified ?? 0), total: Number(rows[0]?.total ?? 0) };
}

/** Called once registerOrg has landed on-chain, with the orgId it returned. */
export async function markApplicationRegistered(
  id: string,
  orgId: string,
  txHash: string
): Promise<OrgApplication | undefined> {
  await sql`insert into orgs (id, name, approver)
            select ${orgId}, name, approver_address from org_applications where id = ${id}
            on conflict (id) do nothing`;
  if (await rewardColumnsAvailable()) {
    await sql`update orgs o set
                contact_email = a.contact_email, contact_phone = a.contact_phone,
                location_type = a.location_type, address = a.address,
                social_x = a.social_x, social_tiktok = a.social_tiktok,
                social_instagram = a.social_instagram
              from org_applications a
              where a.id = ${id} and o.id = ${orgId}`;
  }
  const rows = await sql`
    update org_applications
       set status = 'registered', org_id = ${orgId}, registered_tx = ${txHash},
           updated_at = now()
     where id = ${id} and status = 'signed'
    returning *`;
  const r = (rows as Array<Record<string, unknown>>)[0];
  return r ? toApplication(r) : undefined;
}

export interface UpsertCampaignInput {
  id?: string;
  orgId: string;
  title: string;
  blurb?: string;
  coverUrl?: string | null;
  endsAt?: string | null;
  active?: boolean;
  engagementTypeIds?: string[];
  /**
   * Goal fields: `undefined` leaves the stored value alone (closing/reopening a campaign
   * sends none), `null` clears it. Ignored when the goal columns are unavailable.
   */
  goalType?: GoalType | null;
  goalTarget?: number | null;
  goalLabel?: string | null;
  offerName?: string | null;
  offerUrl?: string | null;
  /** Set on creation only; a campaign never turns into a referral or back. */
  kind?: CampaignKind;
  /** Reward fields follow the goal fields' rule: undefined = leave alone, null = clear. */
  rewardKind?: string | null;
  rewardAmount?: number | null;
  rewardCurrency?: string | null;
  rewardNote?: string | null;
  rewardThreshold?: number | null;
  rewardRepeats?: boolean;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

/**
 * Create or update a campaign, including which engagements count toward it.
 *
 * The slug is derived from the title at creation and then never changes — it is the
 * shared link, and editing a title must not break every post that already points at
 * the campaign. Collisions get a numeric suffix rather than an error because two
 * businesses can plausibly both run a "launch-week".
 */
export async function upsertCampaign(input: UpsertCampaignInput): Promise<Campaign> {
  let row: Record<string, unknown>;

  if (input.id) {
    const rows = await sql`
      update campaigns set
        title = ${input.title}, blurb = ${input.blurb ?? null},
        cover_url = ${input.coverUrl ?? null},
        ends_at = ${input.endsAt ?? null},
        active = ${input.active ?? true}
      where id = ${input.id} and org_id = ${input.orgId}
      returning *`;
    row = (rows as Array<Record<string, unknown>>)[0];
    if (!row) throw new Error("No such campaign for this org");
  } else {
    const base = slugify(input.title) || "campaign";
    let created: Array<Record<string, unknown>> = [];
    for (let n = 0; n < 5 && created.length === 0; n++) {
      const slug = n === 0 ? base : `${base}-${n + 1}`;
      created = (await sql`
        insert into campaigns (org_id, slug, title, blurb, cover_url, ends_at, active)
        values (${input.orgId}, ${slug}, ${input.title}, ${input.blurb ?? null},
                ${input.coverUrl ?? null}, ${input.endsAt ?? null}, ${input.active ?? true})
        on conflict (slug) do nothing
        returning *`) as Array<Record<string, unknown>>;
    }
    if (created.length === 0) throw new Error("Could not find a free link for that title");
    row = created[0];
  }

  const goalFields = [input.goalType, input.goalTarget, input.goalLabel, input.offerName, input.offerUrl];
  if (goalFields.some((v) => v !== undefined) && (await goalColumnsAvailable())) {
    const g = input;
    await sql`
      update campaigns set
        goal_type   = case when ${g.goalType !== undefined}::boolean then ${g.goalType ?? null}::text else goal_type end,
        goal_target = case when ${g.goalTarget !== undefined}::boolean then ${g.goalTarget ?? null}::integer else goal_target end,
        goal_label  = case when ${g.goalLabel !== undefined}::boolean then ${g.goalLabel ?? null}::text else goal_label end,
        offer_name  = case when ${g.offerName !== undefined}::boolean then ${g.offerName ?? null}::text else offer_name end,
        offer_url   = case when ${g.offerUrl !== undefined}::boolean then ${g.offerUrl ?? null}::text else offer_url end
      where id = ${row.id as string} and org_id = ${input.orgId}`;
  }

  const rewardFields = [
    input.rewardKind, input.rewardAmount, input.rewardCurrency, input.rewardNote,
    input.rewardThreshold, input.rewardRepeats,
  ];
  const wantsRewards = rewardFields.some((v) => v !== undefined) || input.kind === "referral";
  if (wantsRewards && (await rewardColumnsAvailable())) {
    const g = input;
    await sql`
      update campaigns set
        kind             = case when ${!input.id && g.kind === "referral"}::boolean then 'referral' else kind end,
        reward_kind      = case when ${g.rewardKind !== undefined}::boolean then ${g.rewardKind ?? null}::text else reward_kind end,
        reward_amount    = case when ${g.rewardAmount !== undefined}::boolean then ${g.rewardAmount ?? null}::numeric else reward_amount end,
        reward_currency  = case when ${g.rewardCurrency !== undefined}::boolean then ${g.rewardCurrency ?? null}::text else reward_currency end,
        reward_note      = case when ${g.rewardNote !== undefined}::boolean then ${g.rewardNote ?? null}::text else reward_note end,
        reward_threshold = case when ${g.rewardThreshold !== undefined}::boolean then ${g.rewardThreshold ?? null}::integer else reward_threshold end,
        reward_repeats   = case when ${g.rewardRepeats !== undefined}::boolean then ${g.rewardRepeats ?? false}::boolean else reward_repeats end
      where id = ${row.id as string} and org_id = ${input.orgId}`;
  }

  if (input.engagementTypeIds) {
    await sql`delete from campaign_engagements where campaign_id = ${row.id as string}`;
    for (const etId of input.engagementTypeIds) {
      await sql`insert into campaign_engagements (campaign_id, engagement_type_id)
                select ${row.id as string}, id from engagement_types
                where id = ${etId} and org_id = ${input.orgId}
                on conflict do nothing`;
    }
  }

  const full = await getCampaignBySlug(row.slug as string);
  if (!full) throw new Error("Campaign vanished mid-save");
  return full;
}

/**
 * Permanently delete a campaign, scoped to its org. `campaign_engagements` and
 * `campaign_participants` cascade; `submissions.campaign_id` is set null, so an
 * advocate's approved work and weight survive — only the campaign lens is removed.
 * Returns false when nothing matched (wrong org, or already gone).
 */
export async function deleteCampaign(orgId: string, id: string): Promise<boolean> {
  const rows = (await sql`delete from campaigns
                          where id = ${id} and org_id = ${orgId}
                          returning id`) as Array<Record<string, unknown>>;
  return rows.length > 0;
}

/**
 * Where a campaign's audience is, stage by stage. `shares` counts people who made a
 * personal link (campaign_shares rows), `clicks` their total clicks. Redemption is not
 * here on purpose: a reward being claimed lives on-chain, not in this table, and a number
 * we can't derive honestly is better left out. Scoped to the org so an id alone can't
 * read another business's numbers.
 */
export async function getCampaignFunnel(
  orgId: string,
  campaignId: string
): Promise<CampaignFunnel | undefined> {
  const rows = (await sql`
    select
      (select count(*) from campaign_shares where campaign_id = c.id) as shares,
      (select coalesce(sum(click_count), 0) from campaign_shares where campaign_id = c.id) as clicks,
      (select count(*) from campaign_participants where campaign_id = c.id) as joined,
      (select count(*) from submissions where campaign_id = c.id) as submitted,
      (select count(*) from submissions where campaign_id = c.id and status = 'approved') as approved,
      (select count(*) from submissions where campaign_id = c.id and status = 'rejected') as rejected,
      (select count(*) from submissions where campaign_id = c.id and status = 'pending') as pending
    from campaigns c
    where c.id = ${campaignId} and c.org_id = ${orgId}`) as Array<Record<string, unknown>>;
  const r = rows[0];
  if (!r) return undefined;
  return {
    shares: Number(r.shares),
    clicks: Number(r.clicks),
    joined: Number(r.joined),
    submitted: Number(r.submitted),
    approved: Number(r.approved),
    rejected: Number(r.rejected),
    pending: Number(r.pending),
  };
}

export interface CampaignWithOrg extends Campaign {
  orgName: string;
}

/** Every live campaign across every registered business — the discovery feed. */
export async function listAllActiveCampaigns(): Promise<CampaignWithOrg[]> {
  const rows = (await sql`
    select c.*, coalesce(nullif(o.display_name, ''), o.name) as org_name,
      coalesce(array_agg(distinct ce.engagement_type_id)
        filter (where ce.engagement_type_id is not null), '{}') as engagement_type_ids,
      count(distinct p.address) as participant_count,
      coalesce(max(sc.approved_n), 0) as approved_count,
      coalesce(max(sc.pending_n), 0) as pending_count
    from campaigns c
    join orgs o on o.id = c.org_id
    left join campaign_engagements ce on ce.campaign_id = c.id
    left join campaign_participants p on p.campaign_id = c.id
    left join (
      select campaign_id,
        count(*) filter (where status = 'approved') as approved_n,
        count(*) filter (where status = 'pending') as pending_n
      from submissions
      where campaign_id is not null and status in ('approved', 'pending')
      group by campaign_id
    ) sc on sc.campaign_id = c.id
    where c.active and (c.ends_at is null or c.ends_at > now())
    group by c.id, o.name, o.display_name
    order by c.starts_at desc`) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ ...toCampaign(r), orgName: r.org_name as string }));
}

/** All campaigns on the platform — upcoming and past — for the campaigns timeline. */
export async function listAllCampaignsDiscover(): Promise<CampaignWithOrg[]> {
  const rows = (await sql`
    select c.*, coalesce(nullif(o.display_name, ''), o.name) as org_name,
      coalesce(array_agg(distinct ce.engagement_type_id)
        filter (where ce.engagement_type_id is not null), '{}') as engagement_type_ids,
      count(distinct p.address) as participant_count,
      coalesce(max(sc.approved_n), 0) as approved_count,
      coalesce(max(sc.pending_n), 0) as pending_count
    from campaigns c
    join orgs o on o.id = c.org_id
    left join campaign_engagements ce on ce.campaign_id = c.id
    left join campaign_participants p on p.campaign_id = c.id
    left join (
      select campaign_id,
        count(*) filter (where status = 'approved') as approved_n,
        count(*) filter (where status = 'pending') as pending_n
      from submissions
      where campaign_id is not null and status in ('approved', 'pending')
      group by campaign_id
    ) sc on sc.campaign_id = c.id
    where c.active
    group by c.id, o.name, o.display_name
    order by c.starts_at desc`) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ ...toCampaign(r), orgName: r.org_name as string }));
}

/** Every campaign this advocate has joined, newest first, with the business's display name. */
export async function listJoinedCampaigns(address: string): Promise<CampaignWithOrg[]> {
  const rows = (await sql`
    select c.*, coalesce(nullif(o.display_name, ''), o.name) as org_name,
      coalesce(array_agg(distinct ce.engagement_type_id)
        filter (where ce.engagement_type_id is not null), '{}') as engagement_type_ids,
      count(distinct p.address) as participant_count,
      coalesce(max(sc.approved_n), 0) as approved_count,
      coalesce(max(sc.pending_n), 0) as pending_count
    from campaign_participants me
    join campaigns c on c.id = me.campaign_id
    join orgs o on o.id = c.org_id
    left join campaign_engagements ce on ce.campaign_id = c.id
    left join campaign_participants p on p.campaign_id = c.id
    left join (
      select campaign_id,
        count(*) filter (where status = 'approved') as approved_n,
        count(*) filter (where status = 'pending') as pending_n
      from submissions
      where campaign_id is not null and status in ('approved', 'pending')
      group by campaign_id
    ) sc on sc.campaign_id = c.id
    where me.address = ${address.toLowerCase()}
    group by c.id, o.name, o.display_name
    order by c.starts_at desc`) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ ...toCampaign(r), orgName: r.org_name as string }));
}

/* --------------------------------------------------------------- wallets */

/**
 * Records that a wallet connected, at connect time.
 *
 * Submissions only know about people who got as far as submitting. This is the earlier
 * fact — who showed up at all — keyed by the acting address, with the signing wallet
 * behind it kept alongside so "which extension was this person using" stays answerable.
 */
export async function recordWalletConnection(p: {
  address: string;
  adminAddress?: string;
  walletId?: string;
}): Promise<void> {
  await sql`
    insert into wallets (address, admin_address, wallet_id)
    values (${p.address.toLowerCase()},
            ${p.adminAddress?.toLowerCase() ?? null},
            ${p.walletId ?? null})
    on conflict (address) do update
      set last_seen_at  = now(),
          connect_count = wallets.connect_count + 1,
          admin_address = coalesce(excluded.admin_address, wallets.admin_address),
          wallet_id     = coalesce(excluded.wallet_id, wallets.wallet_id)`;
}

/* ------------------------------------------------------- campaign overview */

export interface CampaignParticipant {
  address: string;
  displayName?: string;
  referredBy?: string;
  referredByName?: string;
  joinedAt: string;
}

export interface CampaignOverviewRow {
  id: string;
  slug: string;
  title: string;
  active: boolean;
  participants: CampaignParticipant[];
}

export interface OrgCampaignOverview {
  campaigns: CampaignOverviewRow[];
  /** Distinct people across every campaign this business runs. */
  totalUniqueParticipants: number;
}

/**
 * The business's campaign roster: each campaign it runs, exactly who joined it (with
 * who brought them), and the org-wide count of distinct people — because "how many
 * people are my campaigns reaching, total" is a different question from any one
 * campaign's count, and the same person joining three campaigns is one person.
 */
export async function getOrgCampaignOverview(orgId: string): Promise<OrgCampaignOverview> {
  const campaigns = (await sql`
    select id, slug, title, active from campaigns
    where org_id = ${orgId}
    order by active desc, starts_at desc`) as Array<Record<string, unknown>>;

  const participants = (await sql`
    select p.campaign_id, p.address, p.referred_by, p.joined_at,
           a.display_name,
           ref.display_name as referrer_name
    from campaign_participants p
    left join advocates a   on a.org_id = p.org_id and a.address = p.address
    left join advocates ref on ref.org_id = p.org_id and ref.address = p.referred_by
    where p.org_id = ${orgId}
    order by p.joined_at desc`) as Array<Record<string, unknown>>;

  const byCampaign = new Map<string, CampaignParticipant[]>();
  const unique = new Set<string>();
  for (const r of participants) {
    unique.add(r.address as string);
    const list = byCampaign.get(r.campaign_id as string) ?? [];
    list.push({
      address: r.address as string,
      displayName: (r.display_name as string) ?? undefined,
      referredBy: (r.referred_by as string) ?? undefined,
      referredByName: (r.referrer_name as string) ?? undefined,
      joinedAt: new Date(r.joined_at as string).toISOString(),
    });
    byCampaign.set(r.campaign_id as string, list);
  }

  return {
    campaigns: campaigns.map((c) => ({
      id: c.id as string,
      slug: c.slug as string,
      title: c.title as string,
      active: Boolean(c.active),
      participants: byCampaign.get(c.id as string) ?? [],
    })),
    totalUniqueParticipants: unique.size,
  };
}

/* ------------------------------------------------------ rewards owed and given */

export interface RewardDue {
  advocate: string;
  displayName?: string;
  /** Approved actions under the campaign — what earning is measured against. */
  approved: number;
  pending: number;
  /** Rewards this person has earned under the campaign's rule. */
  earned: number;
  /** Rewards the business has marked as handed over. */
  given: number;
  /** earned - given, never below zero. */
  owed: number;
  /** Approved actions still needed for the next reward; undefined when no more can be earned. */
  toNext?: number;
  lastGivenAt?: string;
}

export interface CampaignRewardLedger {
  campaign: Campaign;
  /** Everyone who has done anything under the campaign, most owed first. */
  people: RewardDue[];
  earned: number;
  given: number;
  owed: number;
}

/**
 * Per campaign: who has earned its reward, what has been handed over, and what is
 * still owed. Earned is derived from approved submissions under the campaign and the
 * campaign's reward rule (rewardsEarned in lib/types.ts), so it can never drift from
 * the approvals queue. Only `given` is stored.
 */
export async function getRewardLedger(orgId: string): Promise<CampaignRewardLedger[]> {
  const campaigns = await listCampaigns(orgId);
  const ready = await rewardColumnsAvailable();

  const rows = (await (ready
    ? sql`
      select s.campaign_id, s.advocate,
        count(*) filter (where s.status = 'approved')::int as approved,
        count(*) filter (where s.status = 'pending')::int  as pending,
        coalesce(max(a.display_name), max(s.advocate_label)) as display_name,
        coalesce(max(cr.given_count), 0)::int as given,
        max(cr.last_given_at) as last_given_at
      from submissions s
      left join advocates a on a.org_id = s.org_id and a.address = s.advocate
      left join campaign_rewards cr on cr.campaign_id = s.campaign_id and cr.advocate = s.advocate
      where s.org_id = ${orgId} and s.campaign_id is not null
      group by s.campaign_id, s.advocate`
    : sql`
      select s.campaign_id, s.advocate,
        count(*) filter (where s.status = 'approved')::int as approved,
        count(*) filter (where s.status = 'pending')::int  as pending,
        coalesce(max(a.display_name), max(s.advocate_label)) as display_name,
        0 as given, null as last_given_at
      from submissions s
      left join advocates a on a.org_id = s.org_id and a.address = s.advocate
      where s.org_id = ${orgId} and s.campaign_id is not null
      group by s.campaign_id, s.advocate`)) as Array<Record<string, unknown>>;

  const byCampaign = new Map<string, Array<Record<string, unknown>>>();
  for (const r of rows) {
    const list = byCampaign.get(r.campaign_id as string) ?? [];
    list.push(r);
    byCampaign.set(r.campaign_id as string, list);
  }

  return campaigns.map((c) => {
    const people: RewardDue[] = (byCampaign.get(c.id) ?? []).map((r) => {
      const approved = Number(r.approved);
      const given = Number(r.given);
      const earned = c.rewardKind ? rewardsEarned(approved, c.rewardThreshold, c.rewardRepeats) : 0;
      return {
        advocate: r.advocate as string,
        displayName: (r.display_name as string) ?? undefined,
        approved,
        pending: Number(r.pending),
        earned,
        given,
        owed: Math.max(0, earned - given),
        toNext: c.rewardKind ? actionsToNextReward(approved, c.rewardThreshold, c.rewardRepeats) : undefined,
        lastGivenAt: r.last_given_at ? new Date(r.last_given_at as string).toISOString() : undefined,
      };
    });
    people.sort((a, b) => b.owed - a.owed || b.approved - a.approved || b.pending - a.pending);
    const sum = (k: "earned" | "given" | "owed") => people.reduce((n, p) => n + p[k], 0);
    return { campaign: c, people, earned: sum("earned"), given: sum("given"), owed: sum("owed") };
  });
}

/**
 * Record that the business handed `delta` rewards to a person (negative to undo a
 * mistake). Clamped to [0, earned], so a double-click can't record more than was earned.
 * Returns the new given count, or undefined when the campaign isn't this org's.
 */
export async function recordRewardGiven(input: {
  orgId: string;
  campaignId: string;
  advocate: string;
  delta: number;
  by: string;
}): Promise<{ given: number; earned: number } | undefined> {
  if (!(await rewardColumnsAvailable())) throw new Error("Rewards aren't available on this setup yet");
  const advocate = input.advocate.toLowerCase();
  const rows = (await sql`
    select c.reward_kind, c.reward_threshold, c.reward_repeats,
      (select count(*) from submissions s
        where s.campaign_id = c.id and s.advocate = ${advocate} and s.status = 'approved')::int as approved
    from campaigns c where c.id = ${input.campaignId} and c.org_id = ${input.orgId}`) as Array<
    Record<string, unknown>
  >;
  const c = rows[0];
  if (!c) return undefined;
  const earned = c.reward_kind
    ? rewardsEarned(
        Number(c.approved),
        c.reward_threshold == null ? undefined : Number(c.reward_threshold),
        Boolean(c.reward_repeats)
      )
    : 0;

  const saved = (await sql`
    insert into campaign_rewards (campaign_id, org_id, advocate, given_count, last_given_at, last_given_by)
    values (${input.campaignId}, ${input.orgId}, ${advocate},
            greatest(0, least(${earned}::int, ${input.delta}::int)), now(), ${input.by.toLowerCase()})
    on conflict (campaign_id, advocate) do update set
      given_count = greatest(0, least(${earned}::int, campaign_rewards.given_count + ${input.delta}::int)),
      last_given_at = now(), last_given_by = excluded.last_given_by
    returning given_count`) as Array<Record<string, unknown>>;
  return { given: Number(saved[0].given_count), earned };
}

/* --------------------------------------------------------------- referrals */

/**
 * The engagement a referral counts: the org's active referral-category types, or a
 * "Brought a friend" type created on the spot so a business never has to set one up
 * before it can create a referral.
 */
export async function ensureReferralEngagementIds(orgId: string): Promise<string[]> {
  const existing = (await sql`
    select id from engagement_types
    where org_id = ${orgId} and active and chain_category = 0`) as Array<{ id: string }>;
  if (existing.length) return existing.map((r) => r.id);

  // The seeded pilot org can have no orgs row until something writes one.
  await sql`insert into orgs (id, name) values (${orgId}, '') on conflict (id) do nothing`;
  const rows = (await sql`
    insert into engagement_types (org_id, label, blurb, icon, proof_kind, chain_category, weight)
    values (${orgId}, 'Brought a friend',
            'You brought someone new. Give their name and your referral code.',
            '🤝', 'referral_code', 0, 1)
    on conflict (org_id, label) do update set active = true
    returning id`) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export interface ReferrerRow extends RewardDue {
  /** Clicks on this person's personal link. */
  clicks: number;
  /** People who joined through it. */
  friendsJoined: number;
}

export interface ReferralBoard {
  campaign: Campaign;
  referrers: ReferrerRow[];
  owed: number;
}

/**
 * Referrals and who did what: for each referral the business created, every person
 * who shared it or submitted under it, with their link's clicks and joins next to
 * their approved referrals and the reward that earns them.
 */
export async function getReferralBoards(orgId: string): Promise<ReferralBoard[]> {
  const ledger = (await getRewardLedger(orgId)).filter((l) => l.campaign.kind === "referral");
  if (ledger.length === 0) return [];

  const shares = (await sql`
    select s.campaign_id, s.sharer, s.click_count, s.join_count, a.display_name
    from campaign_shares s
    join campaigns c on c.id = s.campaign_id
    left join advocates a on a.org_id = s.org_id and a.address = s.sharer
    where s.org_id = ${orgId}`) as Array<Record<string, unknown>>;

  return ledger.map(({ campaign, people, owed }) => {
    const rows = new Map<string, ReferrerRow>();
    for (const p of people) rows.set(p.advocate, { ...p, clicks: 0, friendsJoined: 0 });
    for (const s of shares) {
      if (s.campaign_id !== campaign.id) continue;
      const who = s.sharer as string;
      const row =
        rows.get(who) ??
        ({
          advocate: who,
          displayName: (s.display_name as string) ?? undefined,
          approved: 0, pending: 0, earned: 0, given: 0, owed: 0,
          toNext: campaign.rewardKind
            ? actionsToNextReward(0, campaign.rewardThreshold, campaign.rewardRepeats)
            : undefined,
          clicks: 0, friendsJoined: 0,
        } satisfies ReferrerRow);
      row.clicks = Number(s.click_count);
      row.friendsJoined = Number(s.join_count);
      row.displayName ??= (s.display_name as string) ?? undefined;
      rows.set(who, row);
    }
    const referrers = [...rows.values()].sort(
      (a, b) => b.owed - a.owed || b.approved - a.approved || b.friendsJoined - a.friendsJoined || b.clicks - a.clicks
    );
    return { campaign, referrers, owed };
  });
}
