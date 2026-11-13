import type { CampaignWithOrg } from "@/lib/hooks";

/**
 * Campaigns from the Avalanche Fuji testnet pilot (July to November 2026), frozen
 * when production moved to mainnet on 5 November 2026.
 *
 * Their businesses, joins and approvals live in the old testnet database and on the
 * Fuji contract, neither of which mainnet reads, so this public snapshot is what
 * keeps them visible: they are listed under Previous with a Testnet label and have a
 * read-only page at /testnet/<slug>. Public fields only (what the campaign card
 * already showed), counts as they stood at the switch.
 *
 * FitTribe "Founding 20" and MuyuBakes were still running at the switch and were
 * started again on mainnet (orgs #2 and #3, 13 November 2026) under the same slug;
 * `continuesOnMainnet` makes their testnet page point there.
 */
export const TESTNET_ENDED_AT = "2026-11-05T00:00:00.000Z";

interface TestnetRecord {
  slug: string;
  title: string;
  blurb?: string;
  coverUrl?: string;
  startsAt: string;
  endsAt?: string;
  participantCount: number;
  approvedCount: number;
  kind: "campaign" | "referral";
  orgName: string;
  continuesOnMainnet?: boolean;
}

const RECORDS: TestnetRecord[] = [
  {
    "slug": "how-quick-are-you-share-your-fastest-time-to-fin",
    "title": "How quick are you, share your fastest time to finish a level",
    "blurb": "Send a screenshot of your quickest time to complete the project",
    "coverUrl": "https://res.cloudinary.com/dgebpoxc6/image/upload/v1791376275/fnfjdqzwikmymfkxznry.png",
    "startsAt": "2026-10-07T12:33:53.353Z",
    "endsAt": "2027-01-30T00:00:00.000Z",
    "participantCount": 0,
    "approvedCount": 0,
    "kind": "campaign",
    "orgName": "Memorabilia"
  },
  {
    "slug": "muyubakes",
    "title": "MuyuBakes",
    "blurb": "Bring your friends with this campaign link, get extra cookies.",
    "coverUrl": "https://res.cloudinary.com/dgebpoxc6/image/upload/v1791218851/qgj4j8jhtafsuvrdmuoc.jpg",
    "startsAt": "2026-10-05T16:50:23.710Z",
    "endsAt": "2026-12-30T00:00:00.000Z",
    "participantCount": 1,
    "approvedCount": 0,
    "kind": "campaign",
    "orgName": "MuyuBakes",
    "continuesOnMainnet": true
  },
  {
    "slug": "this-week",
    "title": "This week",
    "coverUrl": "https://res.cloudinary.com/dgebpoxc6/image/upload/v1789822731/blnqtmcuc3bihyt7qi1m.jpg",
    "startsAt": "2026-09-19T12:59:25.154Z",
    "endsAt": "2026-09-19T00:00:00.000Z",
    "participantCount": 0,
    "approvedCount": 0,
    "kind": "campaign",
    "orgName": "Kuzana Connect"
  },
  {
    "slug": "celebrate-september-with-nancy-cakes",
    "title": "Celebrate September with Nancy cakes",
    "blurb": "Help spread the sweetness! We're celebrating our custom birthday cake creations by rewarding our community for sharing our work and referring friends for their upcoming celebrations.",
    "coverUrl": "https://res.cloudinary.com/dgebpoxc6/image/upload/v1789658673/fcm0qvlrygxsb8rnwic8.png",
    "startsAt": "2026-09-17T15:24:46.371Z",
    "endsAt": "2026-10-02T00:00:00.000Z",
    "participantCount": 1,
    "approvedCount": 1,
    "kind": "campaign",
    "orgName": "Nancy Bakes"
  },
  {
    "slug": "talk-about-centre",
    "title": "Talk about centre",
    "blurb": "Talk about blockchain space",
    "startsAt": "2026-09-04T09:43:53.506Z",
    "endsAt": "2026-09-16T00:00:00.000Z",
    "participantCount": 1,
    "approvedCount": 1,
    "kind": "campaign",
    "orgName": "Nancy Bakes"
  },
  {
    "slug": "builders-on-avalanche",
    "title": "Builders on Avalanche",
    "blurb": "Meet for builders on avalanche",
    "startsAt": "2026-08-04T19:23:06.608Z",
    "endsAt": "2026-08-08T00:00:00.000Z",
    "participantCount": 1,
    "approvedCount": 1,
    "kind": "campaign",
    "orgName": "Nancy Bakes"
  },
  {
    "slug": "launch-week",
    "title": "Launch Week",
    "blurb": "Launching MissFit for fashion brands to use as a plugin.",
    "startsAt": "2026-07-30T16:44:59.788Z",
    "endsAt": "2026-08-30T00:00:00.000Z",
    "participantCount": 4,
    "approvedCount": 2,
    "kind": "campaign",
    "orgName": "MissFit"
  },
  {
    "slug": "founding-members",
    "title": "Founding 20",
    "blurb": "First 20 people to bring a friend get founding-member status.",
    "startsAt": "2026-07-29T12:44:50.507Z",
    "participantCount": 8,
    "approvedCount": 5,
    "kind": "campaign",
    "orgName": "FitTribe",
    "continuesOnMainnet": true
  },
  {
    "slug": "nights-of-code",
    "title": "Nights of Code",
    "blurb": "We ran an overnight game jam and 155 builders showed up. Tell people what you built and what the room was like — every post counts toward your level.",
    "startsAt": "2026-07-23T07:05:19.556Z",
    "endsAt": "2026-08-31T23:59:59.000Z",
    "participantCount": 10,
    "approvedCount": 4,
    "kind": "campaign",
    "orgName": "Nancy Bakes"
  }
];

/** Every record as a closed campaign card, ended no later than the switch to mainnet. */
export function testnetCampaigns(): CampaignWithOrg[] {
  return RECORDS.map(toCampaign);
}

export function getTestnetCampaign(slug: string): CampaignWithOrg | undefined {
  const record = RECORDS.find((r) => r.slug === slug);
  return record ? toCampaign(record) : undefined;
}

export function testnetSlugs(): string[] {
  return RECORDS.map((r) => r.slug);
}

function toCampaign(r: TestnetRecord): CampaignWithOrg {
  const switchTime = new Date(TESTNET_ENDED_AT).getTime();
  const ended =
    r.endsAt && new Date(r.endsAt).getTime() < switchTime ? r.endsAt : TESTNET_ENDED_AT;
  return {
    id: `testnet-${r.slug}`,
    orgId: "",
    slug: r.slug,
    title: r.title,
    blurb: r.blurb,
    coverUrl: r.coverUrl,
    startsAt: r.startsAt,
    endsAt: ended,
    active: false,
    engagementTypeIds: [],
    participantCount: r.participantCount,
    approvedCount: r.approvedCount,
    pendingCount: 0,
    kind: r.kind,
    rewardRepeats: false,
    orgName: r.orgName,
    network: "testnet",
    continuesOnMainnet: r.continuesOnMainnet ?? false,
  };
}
