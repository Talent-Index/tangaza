"use client";

import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { FeedbackForm, FeedbackWall, useFeedback } from "@/components/feedback/Feedback";
import { isObviouslyTestFeedback } from "@/lib/public-display";

/**
 * Leave feedback, no account needed. Real quotes can show on the homepage once a few
 * people have written in. Obvious placeholders stay off the public wall.
 */
export default function FeedbackPage() {
  const { entries, reload } = useFeedback();
  const visible = (entries ?? []).filter((entry) => !isObviouslyTestFeedback(entry));
  return (
    <div className="marketing light min-h-dvh bg-[#f3f1e9] text-[#15140d]">
      <SiteHeader />
      <main className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <p className="text-[13px] font-semibold text-[#6b4a12]">Feedback</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Tell us what you think.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[#2c2a1f]">
              Good, bad, missing. It all helps. What you write can show on the homepage, with your name if you leave one.
            </p>
          </div>
          <div className="min-w-0 border border-ink-700 bg-ink-850 p-4 sm:p-8 light:rounded-xl light:shadow-sm">
            <FeedbackForm onPosted={reload} />
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-6xl">
          <p className="mb-6 text-base font-semibold text-[#3a382c]">What others said</p>
          <FeedbackWall entries={entries === null ? null : visible} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
