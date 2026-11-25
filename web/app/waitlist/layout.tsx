import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page is a client component, which cannot export metadata, so it lives here.
// Kept out of search results for now: its copy still describes the pre-launch pilot
// ("when the pilot opens near you"), which contradicts the home page now that
// registration is open. Drop `noindex` once the page is rewritten.
export const metadata: Metadata = pageMetadata({
  noindex: true,
  title: "Join the waitlist: referral rewards for shops",
  description:
    "Run a salon, boutique or coffee shop in Kenya? Join the Ubu-Tangaza waitlist to reward the customers who bring you new customers, with proof for each referral.",
  path: "/waitlist",
});

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
