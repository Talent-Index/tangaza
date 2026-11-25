import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

// Signed-in screens (the list and each reward under it): a search engine would only ever see the sign-in prompt.
export const metadata: Metadata = privateMetadata("Your rewards");

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
