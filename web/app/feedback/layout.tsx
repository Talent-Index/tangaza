import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page is a client component, which cannot export metadata, so it lives here.
export const metadata: Metadata = pageMetadata({
  title: "Give feedback: tell us what you think",
  description:
    "Tell us what works, what does not and what is missing in Ubu-Tangaza, the referral and customer rewards tool for small businesses in Kenya. No account needed.",
  path: "/feedback",
});

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
