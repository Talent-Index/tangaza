import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

// The business dashboard and every page under it sit behind sign-in, so none of it belongs in search results.
export const metadata: Metadata = privateMetadata("Your business");

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return children;
}
