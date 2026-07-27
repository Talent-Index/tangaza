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

/** A submission waiting for the org to approve it. Lives off-chain only. */
export type PendingStatus = "pending" | "approved" | "rejected";

export interface PendingActivity {
  id: string;
  orgId: string;
  advocate: string;
  advocateLabel?: string;
  activityType: number;
  proofUrl: string;
  note?: string;
  status: PendingStatus;
  submittedAt: string;
  decidedAt?: string;
  txHash?: string;
  rejectionReason?: string;
}
