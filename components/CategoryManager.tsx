"use client";

import { useState, useTransition } from "react";
import { addCategory, deleteCategory, moveCategory, renameCategory } from "@/app/actions/menu";
import type { ActionResult, CategoryDTO } from "@/lib/types";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

export function CategoryManager({ categories, counts, onClose }: { categories: CategoryDTO[]; counts: Record<string, number>; onClose: () => void }) {
  const [nameNew, setNameNew] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => { const r = await fn(); if (r.ok) { setErr(""); after?.(); } else setErr(r.error); });

  return (
    <Modal title="Kategori menu" onClose={onClose}>
      <div className="stack">
        {categories.map((c, i) => (
          <div className="row nowrap" key={c.id}>
            <input className="in grow" defaultValue={c.name} aria-label="Nama kategori" maxLength={40}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) run(() => renameCategory(c.id, v)); }} />
            <button className="icon-btn" disabled={i === 0 || pending} aria-label="Naikkan" onClick={() => run(() => moveCategory(c.id, -1))}><Icon n="up" s={18} /></button>
            <button className="icon-btn" disabled={i === categories.length - 1 || pending} aria-label="Turunkan" onClick={() => run(() => moveCategory(c.id, 1))}><Icon n="down" s={18} /></button>
            <button className="icon-btn bad" disabled={!!counts[c.id] || pending} aria-label="Hapus kategori"
              title={counts[c.id] ? "Masih ada menu di kategori ini" : "Hapus"} onClick={() => run(() => deleteCategory(c.id))}><Icon n="trash" s={18} /></button>
          </div>
        ))}
        {!categories.length && <p className="hint">Belum ada kategori.</p>}
      </div>
      <p className="hint">Kategori yang masih berisi menu tidak bisa dihapus.</p>
      <form className="row nowrap" onSubmit={(e) => { e.preventDefault(); if (nameNew.trim()) run(() => addCategory(nameNew), () => setNameNew("")); }}>
        <input className="in grow" placeholder="Nama kategori baru" value={nameNew} onChange={(e) => setNameNew(e.target.value)} maxLength={40} />
        <button className="btn" type="submit" disabled={pending}>Tambah</button>
      </form>
      {err && <p className="err" role="alert">{err}</p>}
    </Modal>
  );
}
