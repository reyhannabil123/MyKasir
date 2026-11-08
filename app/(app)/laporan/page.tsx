import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadReport } from "@/lib/reports";
import { parsePeriode, rangeOf } from "@/lib/range";
import { rupiah } from "@/lib/time";
import { fmtDate } from "@/lib/format";
import { PeriodTabs, ReportTabs } from "@/components/ReportTabs";

export const metadata: Metadata = { title: "Laporan" };

export default async function Page({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const u = await requireUser();
  const periode = parsePeriode((await searchParams).periode);
  const { from, to } = rangeOf(periode);
  const r = await loadReport(u.id, from, to);
  const max = Math.max(1, ...r.top.map((t) => t.qty));
  const q = `periode=${periode}`;
  return (
    <div className="stack-lg">
      <header className="ph"><div><h1>Laporan</h1><p className="sub">Pesanan dihitung pada hari pembayarannya.</p></div></header>
      <ReportTabs active="/laporan" />
      <div className="row sb">
        <PeriodTabs base="/laporan" current={periode} />
        <div className="row">
          <a className="btn sm ghost" href={`/api/export?format=xlsx&${q}`} download>Ekspor Excel</a>
          <a className="btn sm ghost" href={`/api/export?format=pdf&${q}`} download>Ekspor PDF</a>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><span>Omzet</span><b>{rupiah(r.omzet)}</b></div>
        <div className="stat"><span>Pesanan lunas</span><b>{r.count}</b></div>
        <div className="stat"><span>Total diskon</span><b>{rupiah(r.discount)}</b></div>
        <div className="stat"><span>Pengeluaran</span><b>{rupiah(r.expenses)}</b></div>
      </div>
      <div className="split">
        <section className="card stack"><h3>Per metode bayar</h3>
          <div className="kv"><span>Tunai</span><b className="num">{rupiah(r.cash)}</b></div>
          <div className="kv"><span>QRIS</span><b className="num">{rupiah(r.qris)}</b></div>
          <div className="kv"><span className="muted">Belum dibayar ({r.unpaid.count}, saat ini)</span><b className="num">{rupiah(r.unpaid.total)}</b></div>
          <div className="rule" />
          <div className="kv"><span>Estimasi untung</span><b className="num" style={{ color: "var(--accent)" }}>{rupiah(r.profit)}</b></div>
          <p className="hint">Omzet dikurangi pengeluaran yang dicatat.</p>
        </section>
        <section className="card stack"><h3>Menu terlaris</h3>
          <div className="bars">
            {r.top.slice(0, 5).map((t) => (
              <div className="bar" key={t.name}>
                <div className="kv"><span>{t.name}</span><b className="num">{t.qty}</b></div>
                <div className="track"><div className="fill" style={{ width: `${(t.qty / max) * 100}%` }} /></div>
              </div>
            ))}
            {!r.top.length && <p className="hint">Belum ada penjualan di periode ini.</p>}
          </div>
        </section>
      </div>
      {r.daily.length > 1 && (
        <section className="card stack"><h3>Per hari</h3>
          <div className="tablewrap"><table className="tbl"><thead><tr><th>Tanggal</th><th className="r">Pesanan</th><th className="r">Omzet</th></tr></thead>
            <tbody>{r.daily.map((d) => <tr key={d.date}><td>{fmtDate(d.date + "T12:00:00+07:00")}</td><td className="r num">{d.count}</td><td className="r num">{rupiah(d.total)}</td></tr>)}</tbody></table></div>
        </section>
      )}
    </div>
  );
}
