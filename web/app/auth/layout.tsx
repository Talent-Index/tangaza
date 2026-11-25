import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

// A sign-in screen has nothing to find in a search. The page is a client component, so its metadata lives here.
export const metadata: Metadata = privateMetadata("Sign in");

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
