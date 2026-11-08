"use client";

import { useMemo, useState } from "react";
import { settleOrder } from "@/app/actions/orders";
import { pad, fmtWhen } from "@/lib/format";
import { rupiah } from "@/lib/time";
import type { OrderRowDTO, PaymentInput } from "@/lib/types";
import { Icon } from "./Icon";
import { OrderRow, methodLabel } from "./OrderList";
import { PayModal } from "./PayModal";
import { ReceiptModal } from "./ReceiptModal";

type St = "unpaid" | "paid" | "all";
type Sort = "new" | "old" | "name" | "amt";

export function BayarNanti({ orders, qrisUrl }: { orders: OrderRowDTO[]; qrisUrl: string | null }) {
  const [st, setSt] = useState<St>("unpaid");
  const [sort, setSort] = useState<Sort>("new");
  const [q, setQ] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [settling, setSettling] = useState<OrderRowDTO | null>(null);

  const unpaid = orders.filter((o) => o.status === "unpaid");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return orders
      .filter((o) => (st === "all" ? true : o.status === st) && (!t || o.customerName.toLowerCase().includes(t) || String(o.number).includes(t)))
      .sort((a, b) =>
        sort === "old" ? +new Date(a.createdAt) - +new Date(b.createdAt)
        : sort === "name" ? (a.customerName || "~").localeCompare(b.customerName || "~", "id")
        : sort === "amt" ? b.total - a.total
        : +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [orders, st, sort, q]);

  async function settle(p: PaymentInput): Promise<string | null> {
    if (!settling || p.kind === "later") return "Metode tidak valid.";
    const r = await settleOrder(settling.id, p);
    if (!r.ok) return r.error;
    const id = settling.id;
    setSettling(null);
    setReceipt(id);
    return null;
  }

  return (
    <div className="stack-lg">
      <header className="ph"><div><h1>Bayar nanti</h1>
        <p className="sub">{unpaid.length} belum lunas · {rupiah(unpaid.reduce((s, o) => s + o.total, 0))}</p></div></header>
      <div className="row">
        <div className="seg">
          {([["unpaid", "Belum lunas"], ["paid", "Sudah lunas"], ["all", "Semua"]] as const).map(([k, l]) => (
            <button key={k} className={st === k ? "on" : ""} onClick={() => setSt(k)}>{l}</button>
          ))}
        </div>
        <div className="search grow" style={{ minWidth: 160 }}><Icon n="search" />
          <input className="in" placeholder="Cari nama atau nomor" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></div>
        <select className="in" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Urutkan">
          <option value="new">Terbaru</option><option value="old">Terlama</option><option value="name">Nama A–Z</option><option value="amt">Nominal terbesar</option>
        </select>
      </div>
      <div className="olist">
        {list.map((o) => (
          <OrderRow key={o.id} o={o} onOpen={() => setReceipt(o.id)}
            extra={o.status === "unpaid" ? (
              <div className="orow-act"><button className="btn sm" onClick={() => setSettling(o)}><Icon n="check" s={16} /> Tandai lunas</button></div>
            ) : (
              <div className="orow-act"><span className="muted small">Lunas {o.paidAt ? fmtWhen(o.paidAt) : ""} · {methodLabel(o)}</span></div>
            )} />
        ))}
        {!list.length && <div className="empty">{orders.length ? "Tidak ada pesanan di sini." : "Belum ada pesanan bayar nanti. Pilih Bayar nanti saat membuat pesanan."}</div>}
      </div>
      {settling && (
        <PayModal title={`Pelunasan #${pad(settling.number)}${settling.customerName ? ` · ${settling.customerName}` : ""}`} total={settling.total}
          qrisUrl={qrisUrl} customerName="" allowLater={false} onClose={() => setSettling(null)} onSubmit={(p) => settle(p)} />
      )}
      {receipt && <ReceiptModal orderId={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
