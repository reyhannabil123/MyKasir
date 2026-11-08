"use client";

import { useState, useTransition } from "react";
import { saveVariantGroup } from "@/app/actions/menu";
import type { VariantGroupDTO } from "@/lib/types";
import { Modal } from "./Modal";
import { MoneyInput } from "./MoneyInput";
import { Icon } from "./Icon";

type Row = { key: number; name: string; price: number };
let k = 0;

export function VariantForm({ group, onClose }: { group?: VariantGroupDTO; onClose: () => void }) {
  const [name, setName] = useState(group?.name ?? "");
  const [required, setRequired] = useState(group?.required ?? false);
  const [rows, setRows] = useState<Row[]>(
    group ? group.options.map((o) => ({ key: ++k, name: o.name, price: o.price })) : [{ key: ++k, name: "", price: 0 }],
  );
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const upd = (key: number, p: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveVariantGroup({ id: group?.id, name, required, options: rows.map(({ name, price }) => ({ name, price })) });
      if (r.ok) onClose(); else setErr(r.error);
    });
  }

  return (
    <Modal title={group ? "Ubah varian" : "Tambah varian"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="f"><span>Nama kategori varian</span>
          <input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Extra Espresso" maxLength={60} />
        </label>
        <div className="stack">
          <b className="lbl">Apakah harus dipilih?</b>
          <div className="seg full">
            <button type="button" className={required ? "on" : ""} onClick={() => setRequired(true)}>Wajib</button>
            <button type="button" className={required ? "" : "on"} onClick={() => setRequired(false)}>Opsional</button>
          </div>
          <p className="hint">{required
            ? "Pelanggan harus memilih salah satu, misalnya Less Ice, Normal, More Ice."
            : "Pelanggan boleh memilih lebih dari satu atau tidak sama sekali, misalnya Extra Espresso."}</p>
        </div>
        <div className="stack">
          <b className="lbl">Pilihan dan harga tambahan</b>
          {rows.map((r) => (
            <div className="row nowrap" key={r.key}>
              <input className="in grow" placeholder="Contoh: Extra Espresso 30ml" value={r.name} maxLength={60}
                onChange={(e) => upd(r.key, { name: e.target.value })} aria-label="Nama pilihan" />
              <div className="priceBox"><MoneyInput value={r.price} onChange={(n) => upd(r.key, { price: n })} aria-label="Harga tambahan" /></div>
              <button type="button" className="icon-btn bad" aria-label="Hapus pilihan" disabled={rows.length === 1}
                onClick={() => setRows(rows.filter((x) => x.key !== r.key))}><Icon n="x" s={18} /></button>
            </div>
          ))}
          <button type="button" className="btn ghost sm" style={{ justifySelf: "start" }}
            onClick={() => setRows([...rows, { key: ++k, name: "", price: 0 }])}><Icon n="plus" s={16} /> Tambah pilihan</button>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn block" type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan varian"}</button>
      </form>
    </Modal>
  );
}
