import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

// A tool for whoever is signing a shop up at its counter, not a page for the public: the page it shares, /waitlist, is the one to find.
export const metadata: Metadata = privateMetadata("Invite a business");

export default function ForBusinessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
