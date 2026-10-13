"use client";

import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { FeedbackForm, FeedbackWall, useFeedback } from "@/components/feedback/Feedback";

const MONO = "font-mono text-[11px] uppercase tracking-[0.2em]";

/**
 * Leave feedback, no account needed. What lands here shows up on the homepage wall
 * immediately, so the page also shows the wall — you see your words where everyone
 * else will.
 */
export default function FeedbackPage() {
  const { entries, reload } = useFeedback();
  return (
    <div className="skin min-h-dvh bg-ink-950 text-mist-100">
      <SiteHeader />
      <main className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <p className={`${MONO} text-crimson-500`}>Feedback</p>
            <h1 className="mt-5 text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl">
              Tell us what you think.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-mist-400">
              Good, bad, missing — it all helps. What you write is shown publicly on the
              homepage, with your name if you leave one.
            </p>
          </div>
          <div className="min-w-0 border border-ink-700 bg-ink-850 p-4 sm:p-8 light:rounded-xl light:shadow-sm">
            <FeedbackForm onPosted={reload} />
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-6xl">
          <p className={`${MONO} mb-6 text-mist-500`}>What others said</p>
          <FeedbackWall entries={entries} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
