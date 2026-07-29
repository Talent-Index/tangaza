/** Activity kinds, matching the contract's ActivityType enum ordering. */
export const ACTIVITY_TYPES = [
  {
    id: 0,
    key: "REFERRAL",
    label: "Referral",
    blurb: "You brought a new member to the Centre",
    icon: "👥",
  },
  {
    id: 1,
    key: "SOCIAL_POST",
    label: "Post on X",
    blurb: "You posted about the Centre on X",
    icon: "𝕏",
  },
  {
    id: 2,
    key: "EVENT_HOSTED",
    label: "Brought an event",
    blurb: "You brought an event or meetup to the Centre",
    icon: "🎤",
  },
] as const;

export type ActivityTypeId = (typeof ACTIVITY_TYPES)[number]["id"];

export const activityLabel = (id: number) =>
  ACTIVITY_TYPES.find((t) => t.id === id)?.label ?? "Activity";

export const activityIcon = (id: number) =>
  ACTIVITY_TYPES.find((t) => t.id === id)?.icon ?? "•";

/** Reward kinds, matching the contract's RewardType enum ordering. */
export const REWARD_TYPES = [
  { id: 0, key: "AIRTIME", label: "Airtime", blurb: "KES 500 airtime, any network", icon: "📱" },
  { id: 1, key: "DATA_BUNDLE", label: "Data bundle", blurb: "KES 500 of data", icon: "📶" },
  { id: 2, key: "VOUCHER", label: "Voucher", blurb: "KES 500 Centre voucher", icon: "🎟️" },
] as const;

export type RewardTypeId = (typeof REWARD_TYPES)[number]["id"];

export const rewardLabel = (id: number) =>
  REWARD_TYPES.find((t) => t.id === id)?.label ?? "Reward";

/**
 * What proof an engagement asks for. Decides which input the submit form renders.
 */
export const PROOF_KINDS = [
  { id: "link", label: "Any link", hint: "https://…" },
  { id: "x_link", label: "Post on X", hint: "https://x.com/you/status/…" },
  { id: "social_link", label: "Instagram / TikTok / Facebook", hint: "https://…" },
  { id: "screenshot", label: "Screenshot", hint: "Paste an image link" },
  { id: "referral_code", label: "Referral code", hint: "The code you gave out" },
  { id: "none", label: "No proof", hint: "The business verifies this offline" },
] as const;

export type ProofKind = (typeof PROOF_KINDS)[number]["id"];

export const proofHint = (kind: ProofKind) =>
  PROOF_KINDS.find((p) => p.id === kind)?.hint ?? "https://…";

/**
 * An engagement a business has chosen to reward. Defined by the business, stored
 * off-chain, and unlimited in number — unlike the contract's fixed ActivityType enum.
 *
 * `weight` is the reward dial: how many on-chain activities one approval counts for.
 * `chainCategory` is which of the contract's three enum values it reports as, so
 * on-chain history stays meaningful when a business invents its own categories.
 */
export interface EngagementType {
  id: string;
  orgId: string;
  label: string;
  blurb?: string;
  icon: string;
  proofKind: ProofKind;
  chainCategory: number;
  weight: number;
  active: boolean;
  sortOrder: number;
}

/**
 * How much we trust that an X handle belongs to the wallet that claimed it.
 *
 * "claimed" is self-declared and proves nothing — anyone can type @jack. Only
 * "verified" links (OAuth, or the business vouching by hand) are eligible for
 * automatic ingestion, because that path leads to a reward.
 */
export type XLinkStatus = "claimed" | "verified";

export interface AdvocateXLink {
  orgId: string;
  address: string;
  xUserId: string;
  xUsername: string;
  status: XLinkStatus;
  linkedAt: string;
  verifiedAt?: string;
}

/** Strips @, whitespace and a pasted profile URL down to the bare handle. */
export function normaliseHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

/** X allows 1–15 chars, letters/digits/underscore only. */
export const isValidHandle = (h: string) => /^[a-z0-9_]{1,15}$/.test(h);

/** A submission waiting for the org to approve it. Lives off-chain only. */
export type PendingStatus = "pending" | "approved" | "rejected";

export interface PendingActivity {
  id: string;
  orgId: string;
  advocate: string;
  advocateLabel?: string;
  engagementTypeId?: string;
  /** Copied from the engagement type at submission time so history cannot shift. */
  typeLabel: string;
  typeIcon: string;
  /** The contract's ActivityType this reports as. */
  activityType: number;
  /** On-chain activities this approval is worth. */
  weight: number;
  proofUrl: string;
  note?: string;
  status: PendingStatus;
  submittedAt: string;
  decidedAt?: string;
  txHash?: string;
  /** The advocate's own on-chain submitActivity transaction. */
  submitTx?: string;
  rejectionReason?: string;
}
