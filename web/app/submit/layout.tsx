import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

// A signed-in form: a search engine would only ever see the sign-in prompt.
export const metadata: Metadata = privateMetadata("Send proof");

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
