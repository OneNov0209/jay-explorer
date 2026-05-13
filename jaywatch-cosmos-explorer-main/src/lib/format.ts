import { defaultNetwork } from "@/data/networks";
import { formatDistanceToNowStrict, format } from "date-fns";

const DECIMALS = defaultNetwork.tokenDecimals;
const DENOM = defaultNetwork.coinDenom;

export function formatAmount(
  raw: string | number | undefined,
  opts: { decimals?: number; symbol?: string; precision?: number } = {},
): string {
  if (raw === undefined || raw === null || raw === "") return `0 ${opts.symbol ?? DENOM}`;
  const decimals = opts.decimals ?? DECIMALS;
  const n = Number(raw) / Math.pow(10, decimals);
  const precision = opts.precision ?? (n >= 1000 ? 2 : 4);
  return `${n.toLocaleString(undefined, { maximumFractionDigits: precision })} ${opts.symbol ?? DENOM}`;
}

export function formatNumber(raw: string | number | undefined, fraction = 0): string {
  if (raw === undefined || raw === null) return "0";
  return Number(raw).toLocaleString(undefined, { maximumFractionDigits: fraction });
}

export function shorten(s: string | undefined, head = 8, tail = 6): string {
  if (!s) return "";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function timeAgo(t: string | number | Date | undefined): string {
  if (!t) return "-";
  try {
    return formatDistanceToNowStrict(new Date(t), { addSuffix: true });
  } catch {
    return "-";
  }
}

export function fmtDate(t: string | number | Date | undefined): string {
  if (!t) return "-";
  try {
    return format(new Date(t), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return "-";
  }
}

export function pct(n: number, digits = 2): string {
  if (!isFinite(n)) return "0%";
  return `${(n * 100).toFixed(digits)}%`;
}
