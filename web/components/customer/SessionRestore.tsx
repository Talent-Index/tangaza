"use client";

import { Spinner } from "@/components/ui";

export function SessionRestoreScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink-950">
      <Spinner className="size-6" />
    </div>
  );
}
