"use client";

import { useState } from "react";
import { rupiah } from "@/lib/time";
import { NO_DISCOUNT, type Discount } from "@/lib/calc";
import type { MenuItemDTO, VariantGroupDTO } from "@/lib/types";
import { Modal } from "./Modal";
import { DiscountInput } from "./DiscountInput";
import { Icon } from "./Icon";

export type CartOption = { id: string; groupId: string; name: string; price: number };
export type CartLine = { key: string; menuItemId: string; name: string; price: number; qty: number; note: string; options: CartOption[]; discount: Discount };

export function ItemModal({ item, groups, line, maxQty, onSave, onRemove, onClose }: {
  item: MenuItemDTO; groups: VariantGroupDTO[]; line?: CartLine; maxQty: number;
  onSave: (l: Omit<CartLine, "key">) => void; onRemove?: () => void; onClose: () => void;
}) {
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const s: Record<string, string[]> = {};
    line?.options.forEach((o) => (s[o.groupId] ??= []).push(o.id));
    return s;
  });
  const [qty, setQty] = useState(line?.qty ?? 1);
  const [note, setNote] = useState(line?.note ?? "");
  const [disc, setDisc] = useState<Discount>(line?.discount ?? NO_DISCOUNT);
  const [warn, setWarn] = useState("");

  const options: CartOption[] = groups.flatMap((g) =>
    g.options.filter((o) => (sel[g.id] ?? []).includes(o.id)).map((o) => ({ id: o.id, groupId: g.id, name: o.name, price: o.price })));
  const ready = groups.every((g) => !g.required || (sel[g.id] ?? []).length === 1);
  const total = (item.price + options.reduce((s, o) => s + o.price, 0)) * qty;

  const toggle = (g: VariantGroupDTO, oid: string, on: boolean) =>
    setSel({ ...sel, [g.id]: g.required ? [oid] : on ? [...(sel[g.id] ?? []), oid] : (sel[g.id] ?? []).filter((x) => x !== oid) });

  return (
    <Modal title={item.name} onClose={onClose}>
      <p className="sub num" style={{ marginTop: -8 }}>{rupiah(item.price)}</p>
      {groups.map((g) => (
        <div className="stack" key={g.id}>
          <div className="row sb"><b>{g.name}</b><span className={`badge ${g.required ? "bad" : ""}`}>{g.required ? "Wajib · pilih 1" : "Opsional"}</span></div>
          {g.options.map((o) => (
            <label className="opt" key={o.id}>
              <input type={g.required ? "radio" : "checkbox"} name={`g_${g.id}`} checked={(sel[g.id] ?? []).includes(o.id)}
                onChange={(e) => toggle(g, o.id, e.target.checked)} />
              <span className="grow">{o.name}</span>{o.price > 0 && <span className="num muted small">+{rupiah(o.price)}</span>}
            </label>
          ))}
        </div>
      ))}
      <label className="f"><span>Catatan <small>(opsional)</small></span>
        <textarea className="in" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Contoh: tanpa gula, pedas banget" />
      </label>
      <div className="stack"><b className="lbl">Diskon item <span className="muted small">(opsional)</span></b>
        <DiscountInput value={disc} onChange={setDisc} placeholder="Tanpa diskon" /></div>
      <div className="row sb"><b>Jumlah</b>
        <div className="qty">
          <button type="button" aria-label="Kurangi" onClick={() => { setWarn(""); setQty(Math.max(1, qty - 1)); }}><Icon n="minus" s={16} /></button>
          <span>{qty}</span>
          <button type="button" aria-label="Tambah" onClick={() => { if (qty + 1 > maxQty) setWarn(`Stok tinggal ${maxQty}.`); else { setWarn(""); setQty(qty + 1); } }}><Icon n="plus" s={16} /></button>
        </div>
      </div>
      {warn && <p className="err">{warn}</p>}
      {!ready && <p className="err">Pilih varian yang wajib dulu.</p>}
      <button className="btn block" disabled={!ready}
        onClick={() => onSave({ menuItemId: item.id, name: item.name, price: item.price, qty, note: note.trim(), options, discount: disc })}>
        {line ? "Simpan perubahan" : "Tambah ke pesanan"} · {rupiah(total)}
      </button>
      {onRemove && <button className="btn danger block" onClick={onRemove}>Hapus dari pesanan</button>}
    </Modal>
  );
}
