import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadReport } from "@/lib/reports";
import { parsePeriode, rangeOf } from "@/lib/range";
import { PeriodTabs, ReportTabs } from "@/components/ReportTabs";
import { Expenses } from "@/components/Expenses";

export const metadata: Metadata = { title: "Pengeluaran" };

export default async function Page({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const u = await requireUser();
  const periode = parsePeriode((await searchParams).periode);
  const { from, to } = rangeOf(periode);
  const r = await loadReport(u.id, from, to);
  return (
    <div className="stack-lg">
      <header className="ph"><div><h1>Laporan</h1></div></header>
      <ReportTabs active="/laporan/pengeluaran" />
      <PeriodTabs base="/laporan/pengeluaran" current={periode} />
      <Expenses list={r.expenseList} total={r.expenses} />
    </div>
  );
}
