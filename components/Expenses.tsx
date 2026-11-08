"use client";

import { useState, useTransition } from "react";
import { addExpense, deleteExpense } from "@/app/actions/reports";
import { fmtWhen } from "@/lib/format";
import { rupiah } from "@/lib/time";
import { Icon } from "./Icon";
import { MoneyInput } from "./MoneyInput";

type Item = { id: string; name: string; amount: number; createdAt: string };

export function Expenses({ list, total }: { list: Item[]; total: number }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [err, setErr] = useState("");
  const [sure, setSure] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await addExpense({ name, amount });
      if (r.ok) { setName(""); setAmount(0); setErr(""); } else setErr(r.error);
    });
  }
  return (
    <div className="stack-lg">
      <form className="card form" onSubmit={add}>
        <h3>Catat pengeluaran</h3>
        <label className="f"><span>Keterangan</span><input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Belanja susu" maxLength={80} /></label>
        <label className="f"><span>Nominal</span><MoneyInput value={amount} onChange={setAmount} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn" type="submit" disabled={pending} style={{ justifySelf: "start" }}><Icon n="plus" /> {pending ? "Menyimpan…" : "Tambah"}</button>
      </form>
      <section className="stack">
        <div className="row sb"><h2>Daftar pengeluaran</h2><b className="num">{rupiah(total)}</b></div>
        {list.map((x) => (
          <div className="vgroup" key={x.id}>
            <div style={{ minWidth: 0 }}><b>{x.name}</b><p className="small muted">{fmtWhen(x.createdAt)}</p></div>
            <div className="row">
              <b className="num">{rupiah(x.amount)}</b>
              {sure === x.id ? (
                <><button className="btn sm danger" disabled={pending} onClick={() => start(async () => { await deleteExpense(x.id); setSure(null); })}>Ya, hapus</button>
                  <button className="btn sm ghost" onClick={() => setSure(null)}>Batal</button></>
              ) : <button className="icon-btn bad" aria-label="Hapus" onClick={() => setSure(x.id)}><Icon n="trash" s={18} /></button>}
            </div>
          </div>
        ))}
        {!list.length && <div className="empty">Belum ada pengeluaran di periode ini.</div>}
      </section>
    </div>
  );
}
