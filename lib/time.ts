/** Batas hari memakai WIB (UTC+7) supaya laporan harian cocok dengan jam toko. */
const WIB = 7 * 60 * 60 * 1000;

export function startOfTodayWIB(now = new Date()): Date {
  const local = new Date(now.getTime() + WIB);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - WIB);
}

export const rupiah = (n: number) =>
  (n < 0 ? "-" : "") + "Rp" + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
