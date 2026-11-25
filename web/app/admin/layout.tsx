import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

// Staff only, and every page under it. Kept out of search results.
export const metadata: Metadata = privateMetadata("Admin");

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
