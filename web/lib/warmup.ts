import { eth_getCode, getRpcClient } from "thirdweb/rpc";
import { CHAIN } from "./chain";
import { client } from "./client";

/**
 * Coordination between the sign-in warmup and the transactions people actually care
 * about — submitting an activity, approving one.
 *
 * thirdweb keeps an in-memory "this account is deploying" flag, keyed by chain and
 * address, and holds it for the entire life of the userOp that carries the account's
 * initCode. Any *second* transaction started while that flag is up is told the account
 * already exists, so it builds an op with no initCode and then parks in an internal
 * wait — which gives up after exactly 60 seconds with "Account deployment is taking
 * too long (over 1 minute). Please try again." The op is never sent. Nothing reaches
 * the bundler, nothing reaches the chain.
 *
 * That is the warmup starving the very action it exists to speed up: sign in, go
 * straight to /submit, press Send inside the first minute, and the two collide. The
 * flag isn't exported, so it can't be cleared from out here — but thirdweb clears it
 * in the `finally` of the warmup's own send, success or failure. So the cure is to
 * join the warmup rather than race it: await the same promise, and by the time we send
 * the account exists and the flag is down, which makes it a light, fast op.
 *
 * The warmup stays fire-and-forget from the UI's point of view. This module only makes
 * it *joinable*, so it can never be something a user waits on without being told why.
 */

/** What a warmup attempt tells us about the account when it settles. */
export type WarmupOutcome = "deployed" | "unresolved";

const inFlight = new Map<string, Promise<WarmupOutcome>>();
/** Accounts we have seen bytecode for. Deployment is one-way, so this never goes stale. */
const deployed = new Set<string>();

const keyOf = (address: string) => `${CHAIN.id}:${address.toLowerCase()}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Does the account contract exist on chain yet? */
export async function accountHasCode(address: string): Promise<boolean> {
  const key = keyOf(address);
  if (deployed.has(key)) return true;

  const rpc = getRpcClient({ client, chain: CHAIN });
  const code = await eth_getCode(rpc, {
    address: address as `0x${string}`,
    blockTag: "latest",
  });
  const exists = Boolean(code && code !== "0x");
  if (exists) deployed.add(key);
  return exists;
}

/**
 * Publish an in-flight deployment so user actions can wait on it.
 *
 * Returns a promise that never rejects: callers of this registry want to know when the
 * attempt is *over*, not whether it threw.
 */
export function trackWarmup(
  address: string,
  run: Promise<unknown>
): Promise<WarmupOutcome> {
  const key = keyOf(address);

  const settled: Promise<WarmupOutcome> = run
    .then((): WarmupOutcome => {
      deployed.add(key);
      return "deployed";
    })
    .catch((): WarmupOutcome => "unresolved")
    .finally(() => {
      // Guard against clobbering a newer attempt for the same account.
      if (inFlight.get(key) === settled) inFlight.delete(key);
    });

  inFlight.set(key, settled);
  return settled;
}

/** Is one of our own deployments in flight for this account right now? */
export function isWarmingUp(address: string): boolean {
  return inFlight.has(keyOf(address));
}

/**
 * Wait until it is safe and fast to send a real transaction from this account.
 *
 * Returns true when the account exists on chain. Returns false when it doesn't and we
 * have no reason to keep waiting — the caller should just send, and its own userOp
 * carries the deployment, exactly as it did before there was a warmup at all.
 *
 * `graceMs` covers the case where the warmup gave up client-side: thirdweb stops
 * waiting on a userOp after 120s and those ops routinely mine shortly afterwards, so a
 * short watch here is often the difference between a light op and a redundant second
 * deployment attempt.
 */
export async function waitForAccountReady(
  address: string,
  {
    timeoutMs = 130_000,
    graceMs = 30_000,
    intervalMs = 3_000,
  }: { timeoutMs?: number; graceMs?: number; intervalMs?: number } = {}
): Promise<boolean> {
  const key = keyOf(address);
  if (deployed.has(key)) return true;

  const pending = inFlight.get(key);
  if (!pending) {
    // Nothing of ours is deploying this account, so there is no flag to collide with
    // and nothing to wait for. Don't stall the user either way.
    return accountHasCode(address).catch(() => false);
  }

  // Settlement is the part that matters: thirdweb releases its deploying flag in the
  // warmup send's `finally`, so once this resolves the caller can no longer be parked
  // behind the 60-second wait.
  const outcome = await Promise.race([
    pending,
    sleep(timeoutMs).then((): WarmupOutcome => "unresolved"),
  ]);
  if (outcome === "deployed") return true;

  const deadline = Date.now() + graceMs;
  for (;;) {
    if (await accountHasCode(address).catch(() => false)) return true;
    if (Date.now() >= deadline) return false;
    await sleep(intervalMs);
  }
}

/**
 * True for the SDK's client-side deployment stall — the failure this module exists to
 * prevent. It is worth retrying because nothing was ever sent: the wait timed out
 * before the op left the browser, and thirdweb clears its flag on the way out, so the
 * retry is free to build a fresh op.
 */
export function isDeploymentStall(message: string): boolean {
  return /Account deployment is taking too long/i.test(message);
}
