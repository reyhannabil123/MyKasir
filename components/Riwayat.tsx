"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { pad } from "@/lib/format";
import { rupiah } from "@/lib/time";
import type { OrderRowDTO } from "@/lib/types";
import { Icon } from "./Icon";
import { OrderList } from "./OrderList";

type Method = "all" | "cash" | "qris" | "later";

export function Riwayat({ orders, period }: { orders: OrderRowDTO[]; period: "today" | "7d" | "all" }) {
  const [method, setMethod] = useState<Method>("all");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return orders.filter((o) =>
      (method === "all" || (method === "later" ? o.status === "unpaid" : o.status === "paid" && o.methods.includes(method))) &&
      (!t || o.customerName.toLowerCase().includes(t) || pad(o.number).includes(t) || String(o.number) === t));
  }, [orders, method, q]);
  const paid = list.filter((o) => o.status === "paid");
  return (
    <div className="stack-lg">
      <header className="ph"><div><h2>Riwayat transaksi</h2>
        <p className="sub">{list.length} pesanan · lunas {rupiah(paid.reduce((s, o) => s + o.total, 0))}</p></div></header>
      <div className="row">
        <div className="seg">
          {([["today", "Hari ini"], ["7d", "7 hari"], ["all", "Semua"]] as const).map(([k, l]) => (
            <Link key={k} href={`/riwayat?periode=${k}`} replace scroll={false} className={`segl ${period === k ? "on" : ""}`}>{l}</Link>
          ))}
        </div>
        <select className="in" style={{ width: "auto" }} value={method} onChange={(e) => setMethod(e.target.value as Method)} aria-label="Metode bayar">
          <option value="all">Semua metode</option><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="later">Belum lunas</option>
        </select>
        <div className="search grow" style={{ minWidth: 160 }}><Icon n="search" />
          <input className="in" placeholder="Cari nama atau nomor" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></div>
      </div>
      <OrderList orders={list} empty="Tidak ada transaksi." />
      {orders.length >= 300 && <p className="hint">Menampilkan 300 pesanan terbaru. Persempit periode untuk melihat yang lain.</p>}
    </div>
  );
}
