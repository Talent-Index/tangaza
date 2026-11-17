/**
 * Kenyan mobile numbers as E.164. M-Pesa and Airtel Money both use 07… and 01… locally.
 * Returns null when the number cannot be a Kenyan handset.
 */
export function normalizeKenyanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("254")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[17]\d{8}$/.test(digits)) return null;
  return `+254${digits}`;
}

/** Last four digits only, for screens and API responses. */
export function maskKenyanPhone(phone: string | null | undefined): string | null {
  const normalized = normalizeKenyanPhone(phone);
  if (!normalized) return null;
  return `${normalized.slice(0, 7)}•••${normalized.slice(-4)}`;
}
