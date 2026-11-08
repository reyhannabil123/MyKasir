"use client";

import { useRef, useState, useTransition } from "react";
import { saveMenuItem } from "@/app/actions/menu";
import { resizeImage } from "@/lib/image";
import type { CategoryDTO, MenuItemDTO, VariantGroupDTO } from "@/lib/types";
import { Modal } from "./Modal";
import { MoneyInput } from "./MoneyInput";
import { Icon } from "./Icon";

export function thumbSrc(m: Pick<MenuItemDTO, "id" | "imgVer">) {
  return m.imgVer ? `/api/menu-image/${m.id}?v=${m.imgVer}` : null;
}
export const hue = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

export function MenuForm({ item, categories, groups, onClose, onNewGroup }: {
  item?: MenuItemDTO; categories: CategoryDTO[]; groups: VariantGroupDTO[]; onClose: () => void; onNewGroup: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item?.price ?? 0);
  const [cat, setCat] = useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [sel, setSel] = useState<string[]>(item?.groupIds ?? []);
  const [unl, setUnl] = useState(item?.unlimitedStock ?? true);
  const [stock, setStock] = useState(item?.stock ?? 0);
  const [img, setImg] = useState<string | undefined>(undefined); // undefined = tidak diubah
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  const current = img !== undefined ? img : item ? thumbSrc(item) ?? "" : "";
  const summary = groups.filter((g) => sel.includes(g.id)).map((g) => g.name).join(", ");

  async function pick(f?: File) {
    if (!f) return;
    try { setImg(await resizeImage(f, 360)); setErr(""); } catch (e) { setErr((e as Error).message); }
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Nama menu wajib diisi.");
    if (!price) return setErr("Harga wajib diisi.");
    start(async () => {
      const r = await saveMenuItem({ id: item?.id, name, price, categoryId: cat || null, groupIds: sel, unlimitedStock: unl, stock, image: img });
      if (r.ok) onClose(); else setErr(r.error);
    });
  }

  return (
    <Modal title={item ? "Ubah menu" : "Tambah menu"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="row">
          <div className="thumb big" style={{ ["--h" as string]: hue(name || "a") }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {current ? <img src={current} alt="" /> : <Icon n="camera" s={26} />}
          </div>
          <button type="button" className="btn ghost sm" onClick={() => file.current?.click()}>Pilih foto</button>
          {current && <button type="button" className="btn ghost sm" onClick={() => setImg("")}>Hapus foto</button>}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <label className="f"><span>Nama menu</span>
          <input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Es Kopi Susu" maxLength={80} />
        </label>
        <label className="f"><span>Harga</span><MoneyInput value={price} onChange={setPrice} /></label>
        <label className="f"><span>Kategori</span>
          <select className="in" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Tanpa kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <div className="stack">
          <b className="lbl">Varian</b>
          {groups.length ? (
            <div>
              <button type="button" className="ms-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
                <span className={`val ${summary ? "" : "ph"}`}>{summary || "Pilih varian"}</span><Icon n="down" s={18} />
              </button>
              {open && (
                <div className="ms-panel">
                  {groups.map((g) => (
                    <label key={g.id} className="ms-item">
                      <input type="checkbox" checked={sel.includes(g.id)}
                        onChange={(e) => setSel(e.target.checked ? [...sel, g.id] : sel.filter((x) => x !== g.id))} />
                      <span className="nm">{g.name}</span>
                      <span className={`badge ${g.required ? "bad" : ""}`}>{g.required ? "Wajib" : "Opsional"}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="notice">
              <span>Varian belum bisa dipilih karena belum ada kategori varian. Buat dulu lewat tombol Tambah varian.</span>
              <button type="button" className="btn sm" onClick={onNewGroup}>Buat varian</button>
            </div>
          )}
        </div>

        <div className="stack">
          <label className="opt"><span>Stok tidak terbatas</span>
            <span className="sw"><input type="checkbox" checked={unl} onChange={(e) => setUnl(e.target.checked)} /><i /></span>
          </label>
          {!unl && (
            <label className="f"><span>Jumlah stok</span>
              <input className="in mono" inputMode="numeric" value={stock || ""} placeholder="0"
                onChange={(e) => setStock(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)} />
            </label>
          )}
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn block" type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan menu"}</button>
      </form>
    </Modal>
  );
}
