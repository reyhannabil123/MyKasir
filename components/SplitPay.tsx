"use client";

import { useEffect, useMemo, useState } from "react";
import { getOrderLines, payPartial } from "@/app/actions/orders";
import { lineCalc, splitOrder } from "@/lib/calc";
import { pad } from "@/lib/format";
import { rupiah } from "@/lib/time";
import type { OrderLinesDTO, PartialResult, PaymentInput } from "@/lib/types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { PayModal } from "./PayModal";

/** Satu orang membayar bagiannya dulu: pilih item yang dibayar sekarang, sisanya tetap di Bayar nanti. */
export function SplitPay({ orderId, qrisUrl, onClose, onDone }: {
  orderId: string; qrisUrl: string | null; onClose: () => void;
  onDone: (r: Extract<PartialResult, { ok: true }>) => void;
}) {
  const [data, setData] = useState<OrderLinesDTO | null>(null);
  const [err, setErr] = useState("");
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    getOrderLines(orderId).then((d) => (d ? setData(d) : setErr("Pesanan tidak ditemukan atau sudah lunas.")));
  }, [orderId]);

  const S = useMemo(() => {
    if (!data) return null;
    const sel = new Map(Object.entries(picks).filter(([, q]) => q > 0));
    return splitOrder(data.lines.map((l) => ({ id: l.id, price: l.price, optionsTotal: l.optionsTotal, qty: l.qty, discount: l.discount })), data.discount, sel);
  }, [data, picks]);

  if (err) return <Modal title="Bayar sebagian" onClose={onClose}><p className="err" role="alert">{err}</p></Modal>;
  if (!data || !S) return <Modal title="Bayar sebagian" onClose={onClose}><div className="skel" style={{ height: 120 }} /></Modal>;

  const chosen = Object.values(picks).reduce((a, b) => a + b, 0);
  const all = data.lines.every((l) => (picks[l.id] ?? 0) === l.qty);
  const set = (id: string, q: number, max: number) => setPicks((p) => ({ ...p, [id]: Math.max(0, Math.min(max, q)) }));
  const title = `Bayar sebagian #${pad(data.number)}${data.customerName ? ` · ${data.customerName}` : ""}`;

  if (paying) {
    return (
      <PayModal title={title} total={S.paid.calc.total} qrisUrl={qrisUrl} customerName="" allowLater={false} onClose={() => setPaying(false)}
        onSubmit={async (p: PaymentInput) => {
          if (p.kind === "later") return "Metode tidak valid.";
          const r = await payPartial(orderId, data.lines.map((l) => ({ itemId: l.id, qty: picks[l.id] ?? 0 })).filter((x) => x.qty > 0), p);
          if (!r.ok) return r.error;
          onDone(r);
          return null;
        }} />
    );
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="stack">
        <p className="hint">Pilih item yang dibayar sekarang. Sisanya tetap di Bayar nanti.</p>
        {data.lines.map((l) => {
          const q = picks[l.id] ?? 0;
          const c = lineCalc({ price: l.price, optionsTotal: l.optionsTotal, qty: l.qty, discount: l.discount });
          return (
            <div className={`pick ${q > 0 ? "on" : ""}`} key={l.id}>
              <div style={{ minWidth: 0 }}>
                <b>{l.name}</b>
                {l.options.length > 0 && <div className="small muted">{l.options.join(", ")}</div>}
                {l.note && <div className="small muted">“{l.note}”</div>}
                <div className="small muted num">{l.qty}× · {rupiah(c.net)}</div>
              </div>
              <div className="qty" role="group" aria-label={`Jumlah ${l.name} yang dibayar`}>
                <button type="button" onClick={() => set(l.id, q - 1, l.qty)} aria-label="Kurangi"><Icon n="minus" s={16} /></button>
                <span>{q}/{l.qty}</span>
                <button type="button" onClick={() => set(l.id, q + 1, l.qty)} aria-label="Tambah"><Icon n="plus" s={16} /></button>
              </div>
            </div>
          );
        })}
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={() => setPicks(Object.fromEntries(data.lines.map((l) => [l.id, l.qty])))}>Pilih semua</button>
          {chosen > 0 && <button type="button" className="btn sm ghost" onClick={() => setPicks({})}>Kosongkan</button>}
        </div>
        <div className="totals">
          <div className="kv"><span>Dibayar sekarang</span><b className="num big">{rupiah(S.paid.calc.total)}</b></div>
          <div className="kv"><span className="muted">{all ? "Semua item dipilih, pesanan lunas penuh" : "Sisa belum lunas"}</span>
            <span className="num">{all ? "" : rupiah(S.remain.calc.total)}</span></div>
        </div>
        <button type="button" className="btn block" disabled={!chosen} onClick={() => setPaying(true)}>
          {chosen ? `Lanjut bayar ${rupiah(S.paid.calc.total)}` : "Pilih item dulu"}
        </button>
      </div>
    </Modal>
  );
}
