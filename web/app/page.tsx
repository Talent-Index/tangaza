import HomeScreen from "@/components/home-screen";
import { getPublicStats } from "@/lib/public-stats";
import type { PublicStats } from "@/lib/public-display";

export const dynamic = "force-dynamic";

/** Chain and database reads must not hold the homepage open if either is down. */
async function loadStats(): Promise<PublicStats | null> {
  try {
    return await Promise.race([
      getPublicStats(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
  } catch (err) {
    console.error("[home:stats]", err);
    return null;
  }
}

export default async function Page() {
  const stats = await loadStats();
  return <HomeScreen initialStats={stats} />;
}
