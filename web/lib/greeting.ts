/** First word of a display name for casual greetings. */
export function firstNameFrom(displayName: string): string {
  const trimmed = displayName.trim().replace(/^@/, "");
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

export interface HomeGreetingContext {
  communities: number;
  pending: number;
  rewardsReady: number;
}

/** Headline + subline for the advocate home hero. */
export function homeGreeting(name: string, ctx: HomeGreetingContext): { headline: string; sub: string } {
  const first = firstNameFrom(name);

  if (ctx.rewardsReady > 0) {
    return {
      headline: `Hi, ${first}`,
      sub:
        ctx.rewardsReady === 1
          ? "You've got a reward ready — back at it?"
          : `You've got ${ctx.rewardsReady} rewards ready — back at it?`,
    };
  }

  if (ctx.pending > 0) {
    return {
      headline: `Hi, ${first}`,
      sub:
        ctx.pending === 1
          ? "One submission is waiting on approval."
          : `${ctx.pending} submissions are waiting on approval.`,
    };
  }

  if (ctx.communities > 0) {
    return {
      headline: `Hi, ${first}`,
      sub: "Back at it — here's where you're standing.",
    };
  }

  return {
    headline: `Hi, ${first}`,
    sub: "Join a campaign and start spreading the word.",
  };
}
