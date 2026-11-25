import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

/**
 * Indexable although it opens on a sign-in: this is where "register my business" should
 * land, and the signed-out view says what the page is for. The page is a client
 * component, which cannot export metadata, so it lives here.
 */
export const metadata: Metadata = pageMetadata({
  title: "Register your business for referral rewards",
  description:
    "Register your business on Ubu-Tangaza to run referral and customer rewards campaigns in Kenya. Say what you will give customers. Nothing to pay to register.",
  path: "/register",
});

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
