import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadClosings, loadReport } from "@/lib/reports";
import { rangeOf } from "@/lib/range";
import { ReportTabs } from "@/components/ReportTabs";
import { CashClosing } from "@/components/CashClosing";

export const metadata: Metadata = { title: "Tutup kasir" };

export default async function Page() {
  const u = await requireUser();
  const { from, to } = rangeOf("today");
  const [r, closings] = await Promise.all([loadReport(u.id, from, to), loadClosings(u.id)]);
  return (
    <div className="stack-lg">
      <header className="ph"><div><h1>Laporan</h1></div></header>
      <ReportTabs active="/laporan/tutup-kasir" />
      <CashClosing cashToday={r.cash} expensesToday={r.expenses} lastCounted={closings[0]?.countedCash ?? 0} closings={closings} />
    </div>
  );
}
