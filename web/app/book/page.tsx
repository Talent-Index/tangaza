import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/BookingForm";
import { Icon } from "@/components/icons";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { SESSION_MINUTES } from "@/lib/booking";
import { CONTACT } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Book a setup session | Ubu-Tangaza",
  description:
    "Tell us your goal and pick a time. We'll build your first campaign around it together: the action, the reward and the budget cap.",
};

export default function BookPage() {
  return (
    <div className="marketing light min-h-dvh bg-[#f3f1e9] text-[#15140d]">
      <SiteHeader />
      <main className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <p className="text-[13px] font-semibold text-[#6b4a12]">Book a setup session</p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
              Tell us your goal. We&rsquo;ll build the campaign around it.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[#2c2a1f]">
              A {SESSION_MINUTES}-minute call. We turn your goal into a campaign, with the action,
              the reward and the budget cap, then you only tap approve. Your first campaign is free.
            </p>
            <ul className="mt-8 space-y-3 text-base text-[#2c2a1f]">
              {[
                "What you want to achieve, and by when",
                "What you're pushing — a product, event or offer",
                "How you'd like people to help, and a reward you're happy to give",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Icon name="clipboard" className="mt-0.5 size-4 shrink-0 text-[#6b4a12]" /> {line}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-base leading-relaxed text-[#3a382c]">
              We use your details only to arrange this session. Prefer email? Write to{" "}
              <a href={`mailto:${CONTACT.email}`} className="underline underline-offset-2 hover:text-mist-300">
                {CONTACT.email}
              </a>
              .
            </p>
          </div>
          <div className="min-w-0 border border-ink-700 bg-ink-850 p-4 sm:p-8 light:rounded-xl light:shadow-sm">
            <BookingForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
