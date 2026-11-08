"use client";

import { useState, useTransition } from "react";
import { saveClosing } from "@/app/actions/reports";
import { fmtWhen } from "@/lib/format";
import { rupiah } from "@/lib/time";
import type { ClosingDTO } from "@/lib/reports";
import { MoneyInput } from "./MoneyInput";

export function CashClosing({ cashToday, expensesToday, lastCounted, closings }: { cashToday: number; expensesToday: number; lastCounted: number; closings: ClosingDTO[] }) {
  const [opening, setOpening] = useState(lastCounted);
  const [drawer, setDrawer] = useState(expensesToday);
  const [counted, setCounted] = useState(0);
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const expected = opening + cashToday - drawer;
  const diff = counted - expected;

  function save() {
    start(async () => {
      const r = await saveClosing({ opening, counted, drawerExpenses: drawer });
      if (r.ok) { setMsg("Tutup kasir tersimpan."); setErr(""); } else { setErr(r.error); setMsg(""); }
    });
  }
  return (
    <div className="stack-lg">
      <section className="card form" style={{ maxWidth: 520 }}>
        <h3>Tutup kasir hari ini</h3>
        <p className="hint">Hitung uang tunai di laci, lalu cocokkan dengan catatan sistem.</p>
        <label className="f"><span>Kas awal di laci <small>(otomatis dari tutup kasir terakhir)</small></span><MoneyInput value={opening} onChange={setOpening} /></label>
        <div className="kv"><span className="muted">Penjualan tunai hari ini</span><b className="num">{rupiah(cashToday)}</b></div>
        <label className="f"><span>Pengeluaran yang diambil dari laci</span><MoneyInput value={drawer} onChange={setDrawer} /></label>
        <div className="kv"><span>Seharusnya ada di laci</span><b className="num">{rupiah(expected)}</b></div>
        <label className="f"><span>Uang tunai yang dihitung</span>
          <MoneyInput value={counted} onChange={(n) => { setCounted(n); setTouched(true); }} /></label>
        {touched && (
          <div className={`change ${diff < 0 ? "short" : ""}`}>
            <span className="small muted">{diff === 0 ? "Pas" : diff > 0 ? "Lebih" : "Kurang"}</span>
            <b className="num">{diff === 0 ? "Tidak ada selisih" : rupiah(Math.abs(diff))}</b>
          </div>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        {msg && <p className="okmsg" role="status">{msg}</p>}
        <button className="btn" disabled={pending || !touched} onClick={save} style={{ justifySelf: "start" }}>{pending ? "Menyimpan…" : "Simpan tutup kasir"}</button>
      </section>
      {closings.length > 0 && (
        <section className="stack"><h2>Riwayat tutup kasir</h2>
          {closings.map((c) => {
            const d = c.countedCash - c.expectedCash;
            return (
              <div className="vgroup" key={c.id}>
                <div><b>{fmtWhen(c.createdAt)}</b><p className="small muted">Seharusnya {rupiah(c.expectedCash)} · dihitung {rupiah(c.countedCash)}</p></div>
                <span className={`badge ${d === 0 ? "good" : "warn"}`}>{d === 0 ? "Pas" : `${d > 0 ? "Lebih" : "Kurang"} ${rupiah(Math.abs(d))}`}</span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
