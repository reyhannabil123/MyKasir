const TZ = "Asia/Jakarta";
export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(new Date(iso)).replace(".", ":");
export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
export const isToday = (iso: string) => dayKey(new Date(iso)) === dayKey(new Date());
export const fmtWhen = (iso: string) => `${isToday(iso) ? "Hari ini" : fmtDate(iso)} ${fmtTime(iso)}`;
export const pad = (n: number) => String(n).padStart(3, "0");
