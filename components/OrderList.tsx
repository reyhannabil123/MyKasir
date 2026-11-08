"use client";

import { useState } from "react";
import { fmtWhen, pad } from "@/lib/format";
import { rupiah } from "@/lib/time";
import type { OrderRowDTO } from "@/lib/types";
import { ReceiptModal } from "./ReceiptModal";

export const methodLabel = (o: OrderRowDTO) =>
  o.status === "unpaid" ? "Bayar nanti" : o.methods.map((m) => (m === "qris" ? "QRIS" : "Tunai")).join(" + ");

export function OrderRow({ o, onOpen, extra }: { o: OrderRowDTO; onOpen: () => void; extra?: React.ReactNode }) {
  return (
    <div className="orow">
      <button className="orow-main" onClick={onOpen}>
        <span><b>#{pad(o.number)}</b> {o.customerName || "Tanpa nama"} <span className="muted small">· {fmtWhen(o.createdAt)}</span></span>
        <b className="t">{rupiah(o.total)}</b>
        <span className="meta">{o.itemsText}</span>
        <span className="r">
          <span className={`badge ${o.status === "paid" ? "good" : "warn"}`}>{o.status === "paid" ? methodLabel(o) : "Belum lunas"}</span>
        </span>
      </button>
      {extra}
    </div>
  );
}

export function OrderList({ orders, empty }: { orders: OrderRowDTO[]; empty: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <div className="olist">
        {orders.map((o) => <OrderRow key={o.id} o={o} onOpen={() => setOpen(o.id)} />)}
        {!orders.length && <div className="empty">{empty}</div>}
      </div>
      {open && <ReceiptModal orderId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
