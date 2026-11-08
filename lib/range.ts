import { startOfTodayWIB } from "./time";

export type Periode = "today" | "yesterday" | "7d" | "30d";
export const PERIODES: { key: Periode; label: string }[] = [
  { key: "today", label: "Hari ini" }, { key: "yesterday", label: "Kemarin" }, { key: "7d", label: "7 hari" }, { key: "30d", label: "30 hari" },
];
const DAY = 86_400_000;

export const parsePeriode = (p: string | undefined): Periode => (p === "yesterday" || p === "7d" || p === "30d" ? p : "today");

/** Rentang [from, to) memakai batas hari WIB. */
export function rangeOf(p: Periode, now = new Date()): { from: Date; to: Date } {
  const t = startOfTodayWIB(now).getTime();
  switch (p) {
    case "yesterday": return { from: new Date(t - DAY), to: new Date(t) };
    case "7d": return { from: new Date(t - 6 * DAY), to: new Date(t + DAY) };
    case "30d": return { from: new Date(t - 29 * DAY), to: new Date(t + DAY) };
    default: return { from: new Date(t), to: new Date(t + DAY) };
  }
}
export const wibDay = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
