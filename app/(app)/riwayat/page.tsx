import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadOrderRows } from "@/lib/orders";
import { startOfTodayWIB } from "@/lib/time";
import { Riwayat } from "@/components/Riwayat";
import { ReportTabs } from "@/components/ReportTabs";

export const metadata: Metadata = { title: "Riwayat" };

export default async function Page({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const u = await requireUser();
  const p = (await searchParams).periode;
  const period = p === "7d" || p === "all" ? p : "today";
  const today = startOfTodayWIB();
  const since = period === "all" ? undefined : period === "7d" ? new Date(today.getTime() - 6 * 86_400_000) : today;
  return (
    <div className="stack-lg">
      <header className="ph"><div><h1>Laporan</h1></div></header>
      <ReportTabs active="/riwayat" />
      <Riwayat orders={await loadOrderRows(u.id, { since, limit: 300 })} period={period} />
    </div>
  );
}
