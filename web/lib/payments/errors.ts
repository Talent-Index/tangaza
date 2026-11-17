/** A payment rule we can show to a person. Never put a key or a raw provider body in `message`. */
export class PaymentError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PaymentError";
    this.status = status;
  }
}

const SECRET_LEAK = /sk_(live|test)_|apk_(live|test)_|whsec_|bearer\s+[a-z0-9_\-]+/i;

/** Provider failures stay useful without echoing credentials that a stack trace might contain. */
export function safeProviderMessage(err: unknown, fallback = "The payment provider did not respond."): string {
  const raw = err instanceof Error ? err.message : fallback;
  if (!raw || SECRET_LEAK.test(raw)) return fallback;
  return raw.slice(0, 200);
}
