/** KES with thousands separators, no decimals — this is money, not a token balance. */
export const kes = (value: bigint | number) =>
  new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(Number(value));

export const kesLabel = (value: bigint | number) => `KES ${kes(value)}`;

export const shortAddress = (address: string) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

export const shortHash = (hash: string) =>
  hash ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : "";

/** Deterministic display name so the leaderboard is readable without a profile store. */
const NAMES = [
  "Wanjiru",
  "Otieno",
  "Achieng",
  "Kamau",
  "Njeri",
  "Mutiso",
  "Chebet",
  "Kiptoo",
  "Wafula",
  "Adhiambo",
  "Mwangi",
  "Nyambura",
];

export function advocateName(address: string) {
  if (!address) return "Advocate";
  const seed = parseInt(address.slice(-4), 16);
  return `${NAMES[seed % NAMES.length]} ${address.slice(2, 4).toUpperCase()}`;
}

export function timeAgo(ms: number) {
  if (!ms) return "—";
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export function formatDate(ms: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
