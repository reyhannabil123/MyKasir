"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createOrder } from "@/app/actions/orders";
import { calcOrder, lineCalc, NO_DISCOUNT, type Discount } from "@/lib/calc";
import { isAvailable } from "@/lib/menu";
import { rupiah } from "@/lib/time";
import type { CreateOrderResult, MenuData, MenuItemDTO, OrderType, PaymentInput } from "@/lib/types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { DiscountInput } from "./DiscountInput";
import { ItemModal, type CartLine } from "./ItemModal";
import { PayModal } from "./PayModal";
import { ReceiptModal } from "./ReceiptModal";
import { hue, thumbSrc } from "./MenuForm";

type ItemModalState = null | { mode: "add"; item: MenuItemDTO } | { mode: "edit"; idx: number };
let seq = 0;
const TYPES: OrderType[] = ["Makan di tempat", "Bawa pulang", "Ojol"];

export function OrderScreen({ data, qrisUrl, nextNumber }: { data: MenuData; qrisUrl: string | null; nextNumber: number }) {
  const { categories, groups, items } = data;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [orderDisc, setOrderDisc] = useState<Discount>(NO_DISCOUNT);
  const [discKey, setDiscKey] = useState(0);
  const [name, setName] = useState("");
  const [type, setType] = useState<OrderType>("Makan di tempat");
  const [table, setTable] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [modal, setModal] = useState<ItemModalState>(null);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<Extract<CreateOrderResult, { ok: true }>["order"] | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const itemById = (id: string) => items.find((m) => m.id === id)!;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2800); };
  const room = (m: MenuItemDTO, skip = -1) =>
    m.unlimitedStock ? Infinity : m.stock - lines.reduce((s, l, i) => s + (l.menuItemId === m.id && i !== skip ? l.qty : 0), 0);

  const calc = useMemo(() => calcOrder(lines.map((l) => ({ price: l.price, optionsTotal: l.options.reduce((s, o) => s + o.price, 0), qty: l.qty, discount: l.discount })), orderDisc), [lines, orderDisc]);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const visible = items.filter((m) => (cat === "all" || (cat === "fav" ? m.favorite : m.categoryId === cat)) && (!q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase())));

  function add(m: MenuItemDTO) {
    if (!isAvailable(m)) return;
    if (room(m) < 1) return flash(`Stok ${m.name} tinggal ${m.stock}.`);
    if (m.groupIds.length) return setModal({ mode: "add", item: m });
    const i = lines.findIndex((l) => l.menuItemId === m.id && !l.options.length && !l.note && !l.discount.value);
    if (i >= 0) setLines(lines.map((l, k) => (k === i ? { ...l, qty: l.qty + 1 } : l)));
    else setLines([...lines, { key: String(++seq), menuItemId: m.id, name: m.name, price: m.price, qty: 1, note: "", options: [], discount: NO_DISCOUNT }]);
  }
  function step(i: number, d: number) {
    const l = lines[i], m = itemById(l.menuItemId);
    if (d > 0 && room(m) < 1) return flash(`Stok ${m.name} tinggal ${m.stock}.`);
    const qty = l.qty + d;
    setLines(qty <= 0 ? lines.filter((_, k) => k !== i) : lines.map((x, k) => (k === i ? { ...x, qty } : x)));
  }
  function save(l: Omit<CartLine, "key">) {
    if (modal?.mode === "add") {
      const same = lines.findIndex((x) => x.menuItemId === l.menuItemId && x.note === l.note && !x.discount.value && !l.discount.value &&
        x.options.map((o) => o.id).sort().join() === l.options.map((o) => o.id).sort().join());
      setLines(same >= 0 ? lines.map((x, k) => (k === same ? { ...x, qty: x.qty + l.qty } : x)) : [...lines, { ...l, key: String(++seq) }]);
    } else if (modal?.mode === "edit") {
      const idx = modal.idx;
      setLines(lines.map((x, k) => (k === idx ? { ...x, ...l } : x)));
    }
    setModal(null);
  }
  function reset() {
    setLines([]); setOrderDisc(NO_DISCOUNT); setDiscKey((k) => k + 1); setName(""); setTable(""); setType("Makan di tempat"); setCartOpen(false);
  }
  async function submit(p: PaymentInput, nameOverride: string): Promise<string | null> {
    const r = await createOrder({
      customerName: p.kind === "later" ? nameOverride : name, orderType: type, tableNo: type === "Makan di tempat" ? table : "",
      lines: lines.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty, note: l.note, optionIds: l.options.map((o) => o.id), discount: l.discount })),
      discount: orderDisc, payment: p,
    });
    if (!r.ok) return r.error;
    setPaying(false); setDone(r.order); reset();
    return null;
  }

  const editLine = modal?.mode === "edit" ? lines[modal.idx] : undefined;
  const modalItem = modal?.mode === "add" ? modal.item : editLine ? itemById(editLine.menuItemId) : undefined;

  const cart = (
    <aside className={`cart ${cartOpen ? "open" : ""}`} aria-label="Keranjang pesanan">
      <div className="chead">
        <h2>Pesanan #{String(nextNumber).padStart(3, "0")}</h2>
        <div className="row">
          {count > 0 && <button className="btn sm ghost" onClick={reset}>Kosongkan</button>}
          <button className="icon-btn closecart" onClick={() => setCartOpen(false)} aria-label="Tutup"><Icon n="x" /></button>
        </div>
      </div>
      <div className="cbody">
        {lines.length === 0 && <div className="empty">Belum ada item. Ketuk menu untuk menambahkan.</div>}
        {lines.map((l, i) => {
          const c = lineCalc({ price: l.price, optionsTotal: l.options.reduce((s, o) => s + o.price, 0), qty: l.qty, discount: l.discount });
          return (
            <div className="line" key={l.key}>
              <div>
                <button className="nm" onClick={() => setModal({ mode: "edit", idx: i })}>{l.name}</button>
                {l.options.length > 0 && <div className="op">{l.options.map((o) => o.name).join(", ")}</div>}
                {l.note && <div className="nt">“{l.note}”</div>}
                {l.discount.value > 0 && <span className="badge good" style={{ marginTop: 4 }}>Diskon {l.discount.mode === "pct" ? `${l.discount.value}%` : rupiah(l.discount.value)}</span>}
              </div>
              <div className="pr">{c.d > 0 && <s>{rupiah(c.base)}</s>}{rupiah(c.net)}</div>
              <div className="row sb nowrap" style={{ gridColumn: "1/-1" }}>
                <button className="btn sm outl" style={{ minHeight: 32 }} onClick={() => setModal({ mode: "edit", idx: i })}>Ubah</button>
                <div className="qty">
                  <button onClick={() => step(i, -1)} aria-label="Kurangi"><Icon n="minus" s={16} /></button>
                  <span>{l.qty}</span>
                  <button onClick={() => step(i, 1)} aria-label="Tambah"><Icon n="plus" s={16} /></button>
                </div>
              </div>
            </div>
          );
        })}
        <label className="f"><span>Atas nama <small>(opsional)</small></span>
          <input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Bu Rina" maxLength={60} autoComplete="off" /></label>
        <div className="stack">
          <div className="seg full">{TYPES.map((t) => <button key={t} className={type === t ? "on" : ""} onClick={() => setType(t)}>{t}</button>)}</div>
          {type === "Makan di tempat" && (
            <label className="f"><span>No. meja <small>(opsional)</small></span>
              <input className="in" value={table} onChange={(e) => setTable(e.target.value)} placeholder="Contoh: 4" maxLength={20} autoComplete="off" /></label>
          )}
        </div>
      </div>
      <div className="cfoot">
        <div className="totals">
          <div className="kv"><span className="muted">Subtotal</span><span className="num">{rupiah(calc.subtotal)}</span></div>
          {calc.itemDiscount > 0 && <div className="kv"><span className="muted">Diskon item</span><span className="num">-{rupiah(calc.itemDiscount)}</span></div>}
          <DiscountInput key={discKey} value={orderDisc} onChange={setOrderDisc} placeholder="Diskon pesanan" />
          {calc.orderDiscount > 0 && <div className="kv"><span className="muted">Potongan</span><span className="num">-{rupiah(calc.orderDiscount)}</span></div>}
          <div className="kv"><span>Total</span><span className="big num">{rupiah(calc.total)}</span></div>
        </div>
        <button className="btn block" disabled={!count} onClick={() => { setCartOpen(false); setPaying(true); }}>{count ? `Bayar ${rupiah(calc.total)}` : "Bayar"}</button>
      </div>
    </aside>
  );

  return (
    <div className="order">
      <section>
        <div className="menuhead">
          <Link className="icon-btn" href="/" aria-label="Kembali"><Icon n="back" /></Link>
          <h1 style={{ fontSize: 22 }}>Pesanan baru</h1>
        </div>
        <div className="search"><Icon n="search" /><input className="in" placeholder="Cari menu" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></div>
        <div className="chips" style={{ marginTop: 12 }}>
          {[{ id: "all", name: "Semua" }, { id: "fav", name: "★ Favorit" }, ...categories].map((c) => (
            <button key={c.id} className={`chip ${cat === c.id ? "on" : ""}`} onClick={() => setCat(c.id)}>{c.name}</button>
          ))}
        </div>
        <div className="grid">
          {visible.map((m) => {
            const ok = isAvailable(m), src = thumbSrc(m);
            return (
              <button key={m.id} className="mcard" disabled={!ok} onClick={() => add(m)}>
                <div className="thumb" style={{ ["--h" as string]: hue(m.name) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {src ? <img src={src} alt="" loading="lazy" /> : m.name[0]?.toUpperCase()}
                </div>
                {!ok ? <span className="tag badge bad">Habis</span> : !m.unlimitedStock && m.stock <= 5 ? <span className="tag badge warn">Sisa {m.stock}</span> : null}
                {m.favorite && <span className="star"><Icon n="star" s={18} fill /></span>}
                <div className="mb"><b>{m.name}</b><span>{rupiah(m.price)}{m.groupIds.length ? " · varian" : ""}</span></div>
              </button>
            );
          })}
          {visible.length === 0 && (
            <div className="empty" style={{ gridColumn: "1/-1" }}>
              {items.length === 0 ? <>Belum ada menu. <Link href="/menu" style={{ textDecoration: "underline" }}>Tambah menu dulu</Link>.</> : "Menu tidak ditemukan."}
            </div>
          )}
        </div>
        <div className="sheetbottom-pad" />
      </section>

      {cart}
      {cartOpen && <div className="backdrop show" onClick={() => setCartOpen(false)} />}
      <div className="cartbar">
        <button className="btn" onClick={() => setCartOpen(true)}>
          <span className="row nowrap"><Icon n="cart" /> {count ? `${count} item` : "Keranjang kosong"}</span><b className="num">{rupiah(calc.total)}</b>
        </button>
      </div>

      {modal && modalItem && (
        <ItemModal key={modal.mode === "edit" ? `e${modal.idx}` : `a${modalItem.id}`} item={modalItem}
          groups={groups.filter((g) => modalItem.groupIds.includes(g.id))} line={editLine}
          maxQty={room(modalItem, modal.mode === "edit" ? modal.idx : -1)}
          onSave={save} onClose={() => setModal(null)}
          onRemove={editLine ? () => { setLines(lines.filter((_, k) => k !== (modal as { idx: number }).idx)); setModal(null); } : undefined} />
      )}
      {paying && <PayModal total={calc.total} qrisUrl={qrisUrl} customerName={name} onClose={() => setPaying(false)} onSubmit={submit} />}
      {done && (
        <Modal title={done.status === "paid" ? "Pembayaran selesai" : "Disimpan di Bayar nanti"} onClose={() => setDone(null)}>
          <div className="stack">
            <div className="kv"><span className="muted">Pesanan</span><b className="num">#{String(done.number).padStart(3, "0")}{done.customerName ? ` · ${done.customerName}` : ""}</b></div>
            <div className="kv"><span className="muted">Total</span><b className="num">{rupiah(done.total)}</b></div>
            {done.change > 0 && <div className="change"><span className="small muted">Kembalian</span><b className="num">{rupiah(done.change)}</b></div>}
          </div>
          <button className="btn ghost block" onClick={() => { setReceiptId(done.id); setDone(null); }}>Lihat dan cetak struk</button>
          <button className="btn block" onClick={() => setDone(null)}>Pesanan baru</button>
        </Modal>
      )}
      {receiptId && <ReceiptModal orderId={receiptId} onClose={() => setReceiptId(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
