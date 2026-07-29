import "server-only";
import { sql } from "./db";
import type {
  AdvocateXLink,
  EngagementType,
  PendingActivity,
  PendingStatus,
  ProofKind,
  XLinkStatus,
} from "./types";

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
  engagement_type_id: string | null;
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
  engagementTypeId: r.engagement_type_id ?? undefined,
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
   * Deliberately does not write display_name.
   *
   * It used to, from whatever label the submit form sent — and that label was the UI's
   * display name, which falls back to a nickname generated from the wallet address when
   * the social login exposes nothing. So a pseudonym got persisted as though the person
   * had chosen it, and then won every subsequent lookup. The name a person picks is
   * owned by PUT /api/me and nothing else may overwrite it.
   */
  await sql`insert into advocates (org_id, address)
            values (${input.orgId}, ${advocate})
            on conflict (org_id, address) do update
              set last_active_at = now()`;

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
  const rows = await sql`
    select * from submissions
    where (${filter.orgId ?? null}::bigint  is null or org_id  = ${filter.orgId ?? null}::bigint)
      and (${advocate}::text                is null or advocate = ${advocate}::text)
      and (${filter.status ?? null}::text   is null or status   = (${filter.status ?? null})::submission_status)
    order by submitted_at desc`;
  return (rows as SubmissionRow[]).map(toActivity);
}

export async function getActivity(id: string): Promise<PendingActivity | undefined> {
  const rows = (await sql`select * from submissions where id = ${id}`) as SubmissionRow[];
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
  return {
    address: addr,
    displayName: (r?.display_name as string) ?? undefined,
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
}

/** The business's contact list: who they are, what they're worth, how to find them. */
export async function listDirectory(orgId: string, limit = 100): Promise<DirectoryEntry[]> {
  const rows = (await sql`
    select * from advocate_directory
    where org_id = ${orgId}
    order by approved_weight desc nulls last, last_submitted_at desc nulls last
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
}

const toTier = (r: Record<string, unknown>): RewardTier => ({
  id: r.id as string,
  orgId: String(r.org_id),
  level: Number(r.level),
  name: r.name as string,
  perk: r.perk as string,
  icon: r.icon as string,
  thresholdWeight: Number(r.threshold_weight),
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
}): Promise<RewardTier> {
  const rows = await sql`
    insert into reward_tiers (org_id, level, name, perk, icon, threshold_weight)
    values (${input.orgId}, ${input.level}, ${input.name}, ${input.perk},
            ${input.icon ?? "★"}, ${input.thresholdWeight})
    on conflict (org_id, level) do update
      set name = excluded.name, perk = excluded.perk, icon = excluded.icon,
          threshold_weight = excluded.threshold_weight
    returning *`;
  return toTier((rows as Array<Record<string, unknown>>)[0]);
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
  startsAt: string;
  endsAt?: string;
  active: boolean;
  engagementTypeIds: string[];
  participantCount: number;
}

const CAMPAIGN_SELECT = `
  c.*,
  coalesce(array_agg(distinct ce.engagement_type_id) filter (where ce.engagement_type_id is not null), '{}') as engagement_type_ids,
  count(distinct p.address) as participant_count`;

const toCampaign = (r: Record<string, unknown>): Campaign => ({
  id: r.id as string,
  orgId: String(r.org_id),
  slug: r.slug as string,
  title: r.title as string,
  blurb: (r.blurb as string) ?? undefined,
  startsAt: new Date(r.starts_at as string).toISOString(),
  endsAt: r.ends_at ? new Date(r.ends_at as string).toISOString() : undefined,
  active: Boolean(r.active),
  engagementTypeIds: (r.engagement_type_ids as string[]) ?? [],
  participantCount: Number(r.participant_count ?? 0),
});

export async function listCampaigns(orgId: string): Promise<Campaign[]> {
  const rows = (await sql`
    select c.*,
      coalesce(array_agg(distinct ce.engagement_type_id)
        filter (where ce.engagement_type_id is not null), '{}') as engagement_type_ids,
      count(distinct p.address) as participant_count
    from campaigns c
    left join campaign_engagements ce on ce.campaign_id = c.id
    left join campaign_participants p on p.campaign_id = c.id
    where c.org_id = ${orgId}
    group by c.id
    order by c.active desc, c.starts_at desc`) as Array<Record<string, unknown>>;
  return rows.map(toCampaign);
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | undefined> {
  const rows = (await sql`
    select c.*,
      coalesce(array_agg(distinct ce.engagement_type_id)
        filter (where ce.engagement_type_id is not null), '{}') as engagement_type_ids,
      count(distinct p.address) as participant_count
    from campaigns c
    left join campaign_engagements ce on ce.campaign_id = c.id
    left join campaign_participants p on p.campaign_id = c.id
    where c.slug = ${slug}
    group by c.id`) as Array<Record<string, unknown>>;
  return rows[0] ? toCampaign(rows[0]) : undefined;
}

/** Joining is free and reversible — it only scopes what you see, never what you earn. */
export async function joinCampaign(
  campaignId: string,
  orgId: string,
  address: string
): Promise<boolean> {
  const rows = await sql`
    insert into campaign_participants (campaign_id, org_id, address)
    values (${campaignId}, ${orgId}, ${address.toLowerCase()})
    on conflict (campaign_id, address) do nothing
    returning campaign_id`;
  return (rows as unknown[]).length > 0;
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

export interface OrgApplication {
  id: string;
  name: string;
  contactEmail?: string;
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
  id: r.id as string,
  name: r.name as string,
  contactEmail: (r.contact_email as string) ?? undefined,
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
export async function createApplication(input: {
  name: string;
  contactEmail?: string;
  approverAddress: string;
  emissionCapKes: number;
  pledge: string;
  signature: string;
  signedMessage: string;
}): Promise<OrgApplication> {
  const rows = await sql`
    insert into org_applications
      (name, contact_email, approver_address, emission_cap_kes, pledge,
       signature, signed_message, signed_at, status)
    values
      (${input.name}, ${input.contactEmail ?? null}, ${input.approverAddress.toLowerCase()},
       ${input.emissionCapKes}, ${input.pledge}, ${input.signature},
       ${input.signedMessage}, now(), 'signed')
    returning *`;
  return toApplication((rows as Array<Record<string, unknown>>)[0]);
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

export async function getApplication(id: string): Promise<OrgApplication | undefined> {
  const rows = (await sql`select * from org_applications where id = ${id}`) as Array<
    Record<string, unknown>
  >;
  return rows[0] ? toApplication(rows[0]) : undefined;
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
  endsAt?: string | null;
  active?: boolean;
  engagementTypeIds?: string[];
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
        insert into campaigns (org_id, slug, title, blurb, ends_at, active)
        values (${input.orgId}, ${slug}, ${input.title}, ${input.blurb ?? null},
                ${input.endsAt ?? null}, ${input.active ?? true})
        on conflict (slug) do nothing
        returning *`) as Array<Record<string, unknown>>;
    }
    if (created.length === 0) throw new Error("Could not find a free link for that title");
    row = created[0];
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

export interface CampaignWithOrg extends Campaign {
  orgName: string;
}

/** Every live campaign across every registered business — the discovery feed. */
export async function listAllActiveCampaigns(): Promise<CampaignWithOrg[]> {
  const rows = (await sql`
    select c.*, o.name as org_name,
      coalesce(array_agg(distinct ce.engagement_type_id)
        filter (where ce.engagement_type_id is not null), '{}') as engagement_type_ids,
      count(distinct p.address) as participant_count
    from campaigns c
    join orgs o on o.id = c.org_id
    left join campaign_engagements ce on ce.campaign_id = c.id
    left join campaign_participants p on p.campaign_id = c.id
    where c.active and (c.ends_at is null or c.ends_at > now())
    group by c.id, o.name
    order by c.starts_at desc`) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ ...toCampaign(r), orgName: r.org_name as string }));
}
