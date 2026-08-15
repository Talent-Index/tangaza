"use client";

import { useSyncExternalStore } from "react";
import { watchContractEvents } from "thirdweb";
import { contract, isConfigured } from "./client";

/**
 * One shared subscription to everything TangazaRewards emits, so dashboards react
 * to transactions the moment they land instead of waiting out a poll interval.
 *
 * Every data hook folds `useChainTick()` into its reload deps: when any contract
 * event arrives (a submission from an advocate's phone, an approval from another
 * tab, a claim, a redemption), the tick bumps and every mounted panel refetches
 * at once. Polling stays underneath as the fallback for anything events can't
 * carry — plain AVAX transfers, the off-chain application queue, RPC hiccups.
 *
 * The watcher is refcounted: it starts with the first subscribed panel, stops with
 * the last, and pauses while the tab is hidden so a dashboard left on a projector
 * doesn't poll logs all afternoon. Coming back to the tab bumps immediately —
 * "switch back and it's already current" is the reload-button killer.
 */

let version = 0;
const listeners = new Set<() => void>();
let unwatch: (() => void) | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;

function notify() {
  version += 1;
  for (const l of listeners) l();
}

/** Events arrive per block; coalesce a burst into one refetch wave. */
function bumpSoon() {
  if (debounce) return;
  debounce = setTimeout(() => {
    debounce = null;
    notify();
  }, 250);
}

function startWatcher() {
  if (unwatch || !isConfigured) return;
  try {
    unwatch = watchContractEvents({
      contract,
      onEvents: (events) => {
        if (events.length > 0) bumpSoon();
      },
    });
  } catch {
    // The watcher is an enhancement — polling still covers if it can't start.
  }
}

function stopWatcher() {
  unwatch?.();
  unwatch = null;
}

function onVisibility() {
  if (document.visibilityState === "hidden") {
    stopWatcher();
  } else if (listeners.size > 0) {
    startWatcher();
    notify(); // catch up on whatever happened while we weren't looking
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    startWatcher();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      stopWatcher();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    }
  };
}

/**
 * A number that increments whenever the contract emits an event (or the tab
 * regains focus). Put it in a data effect's deps to make that data live.
 */
export function useChainTick(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}
