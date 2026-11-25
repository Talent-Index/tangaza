import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

// A signed-in screen: a search engine would only ever see the sign-in prompt.
export const metadata: Metadata = privateMetadata("Your profile");

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
