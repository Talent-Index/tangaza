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
  rejectionReason?: string;
}
