"use client";

import { useState, useTransition } from "react";
import { deleteMenuItem, deleteVariantGroup, moveMenuItem, toggleFavorite, toggleSoldOut } from "@/app/actions/menu";
import { isAvailable } from "@/lib/menu";
import { rupiah } from "@/lib/time";
import type { ActionResult, MenuData, MenuItemDTO } from "@/lib/types";
import { Icon } from "./Icon";
import { MenuForm, hue, thumbSrc } from "./MenuForm";
import { VariantForm } from "./VariantForm";
import { CategoryManager } from "./CategoryManager";

type ModalState = null | { t: "item"; id?: string } | { t: "group"; id?: string } | { t: "cats" };

export function MenuManager({ data }: { data: MenuData }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [delGroup, setDelGroup] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => { const r = await fn(); setMsg(r.ok ? "" : r.error); setDelId(null); setDelGroup(null); });

  const { categories, groups, items } = data;
  const sections = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: items.filter((m) => m.categoryId === c.id) })),
    ...(items.some((m) => !m.categoryId || !categories.some((c) => c.id === m.categoryId))
      ? [{ id: "-", name: "Tanpa kategori", items: items.filter((m) => !m.categoryId || !categories.some((c) => c.id === m.categoryId)) }] : []),
  ];
  const counts = Object.fromEntries(categories.map((c) => [c.id, items.filter((m) => m.categoryId === c.id).length]));
  const editing = modal?.t === "item" && modal.id ? items.find((m) => m.id === modal.id) : undefined;
  const editingGroup = modal?.t === "group" && modal.id ? groups.find((g) => g.id === modal.id) : undefined;

  function row(m: MenuItemDTO, same: MenuItemDTO[]) {
    const i = same.indexOf(m), src = thumbSrc(m), ok = isAvailable(m);
    const stockBadge = !ok
      ? <button className="badge bad" onClick={() => run(() => toggleSoldOut(m.id))}>Habis · ketuk untuk sediakan</button>
      : m.unlimitedStock
        ? <button className="badge good" onClick={() => run(() => toggleSoldOut(m.id))}>Stok tak terbatas</button>
        : <button className={`badge ${m.stock <= 5 ? "warn" : "good"}`} onClick={() => run(() => toggleSoldOut(m.id))}>Stok {m.stock}</button>;
    return (
      <div className="mrow" key={m.id}>
        <div className="thumb" style={{ ["--h" as string]: hue(m.name) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="" loading="lazy" /> : m.name[0]?.toUpperCase()}
        </div>
        <div className="minfo">
          <b>{m.name}</b><span className="num muted">{rupiah(m.price)}</span>
          <div className="tags">{stockBadge}{m.groupIds.length > 0 && <span className="badge">{m.groupIds.length} varian</span>}</div>
        </div>
        <div className="acts">
          {delId === m.id ? (
            <>
              <span className="err">Yakin hapus?</span>
              <button className="btn sm danger" onClick={() => run(() => deleteMenuItem(m.id))}>Ya, hapus</button>
              <button className="btn sm ghost" onClick={() => setDelId(null)}>Batal</button>
            </>
          ) : (
            <>
              <button className="icon-btn" disabled={i === 0 || pending} aria-label="Naikkan" onClick={() => run(() => moveMenuItem(m.id, -1))}><Icon n="up" s={18} /></button>
              <button className="icon-btn" disabled={i === same.length - 1 || pending} aria-label="Turunkan" onClick={() => run(() => moveMenuItem(m.id, 1))}><Icon n="down" s={18} /></button>
              <button className={`icon-btn ${m.favorite ? "fav" : ""}`} aria-label="Favorit" aria-pressed={m.favorite} onClick={() => run(() => toggleFavorite(m.id))}><Icon n="star" s={18} fill={m.favorite} /></button>
              <button className="icon-btn" aria-label="Ubah" onClick={() => setModal({ t: "item", id: m.id })}><Icon n="edit" s={18} /></button>
              <button className="icon-btn bad" aria-label="Hapus" onClick={() => setDelId(m.id)}><Icon n="trash" s={18} /></button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg" style={{ opacity: pending ? 0.7 : 1 }}>
      <header className="ph"><div><h1>Menu</h1><p className="sub">{items.length} menu · {groups.length} kategori varian</p></div></header>
      <div className="row">
        <button className="btn" onClick={() => setModal({ t: "item" })}><Icon n="plus" /> Tambah menu</button>
        <button className="btn ghost" onClick={() => setModal({ t: "group" })}><Icon n="tag" /> Tambah varian</button>
        <button className="btn outl" onClick={() => setModal({ t: "cats" })}><Icon n="list" /> Kategori menu</button>
      </div>
      {msg && <p className="notice" role="alert">{msg}</p>}

      {items.length === 0 && <div className="empty">Belum ada menu. Ketuk Tambah menu untuk mulai. Kalau menu punya pilihan seperti es batu atau extra shot, buat dulu lewat Tambah varian.</div>}
      {sections.map((s) => (
        <section key={s.id}>
          <div className="cathead"><h2>{s.name} <span className="muted small">{s.items.length}</span></h2></div>
          <div className="stack">{s.items.map((m) => row(m, s.items))}
            {!s.items.length && <div className="empty">Belum ada menu di kategori ini.</div>}</div>
        </section>
      ))}

      <section>
        <div className="cathead"><h2>Varian</h2></div>
        <div className="stack">
          {groups.map((g) => (
            <div className="vgroup" key={g.id}>
              <div style={{ minWidth: 0 }}>
                <div className="row"><b>{g.name}</b><span className={`badge ${g.required ? "bad" : ""}`}>{g.required ? "Wajib" : "Opsional"}</span></div>
                <p className="small muted">{g.options.map((o) => o.name + (o.price ? ` +${rupiah(o.price)}` : "")).join(" · ")}</p>
              </div>
              <div className="row">
                {delGroup === g.id ? (
                  <><button className="btn sm danger" onClick={() => run(() => deleteVariantGroup(g.id))}>Ya, hapus</button>
                    <button className="btn sm ghost" onClick={() => setDelGroup(null)}>Batal</button></>
                ) : (
                  <><button className="icon-btn" aria-label="Ubah varian" onClick={() => setModal({ t: "group", id: g.id })}><Icon n="edit" s={18} /></button>
                    <button className="icon-btn bad" aria-label="Hapus varian" onClick={() => setDelGroup(g.id)}><Icon n="trash" s={18} /></button></>
                )}
              </div>
            </div>
          ))}
          {!groups.length && <div className="empty">Belum ada varian. Buat lewat tombol Tambah varian, lalu pilih saat menambah menu.</div>}
        </div>
      </section>

      {modal?.t === "item" && (modal.id ? editing : true) && (
        <MenuForm key={modal.id ?? "new"} item={editing} categories={categories} groups={groups} onClose={() => setModal(null)} onNewGroup={() => setModal({ t: "group" })} />
      )}
      {modal?.t === "group" && (modal.id ? editingGroup : true) && (
        <VariantForm key={modal.id ?? "new"} group={editingGroup} onClose={() => setModal(null)} />
      )}
      {modal?.t === "cats" && <CategoryManager categories={categories} counts={counts} onClose={() => setModal(null)} />}
    </div>
  );
}
