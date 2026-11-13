"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { menuItems, menuItemVariantGroups, orderItems, orders, payments, variantGroups, variantOptions } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { calcOrder, splitOrder, type Discount, type SplitLine } from "@/lib/calc";
import { loadReceipt } from "@/lib/orders";
import type { ActionResult, AddItemsResult, CreateOrderInput, CreateOrderResult, OrderLinesDTO, PartialResult, ReceiptDTO, SettleInput } from "@/lib/types";

const fail = (error: string): CreateOrderResult => ({ ok: false, error });
const TYPES = ["Makan di tempat", "Bawa pulang", "Ojol"];

function cleanDiscount(d: Discount | undefined): Discount {
  const mode = d?.mode === "pct" ? "pct" : "rp";
  const v = Number(d?.value);
  if (!Number.isFinite(v) || v <= 0) return { mode, value: 0 };
  return mode === "pct" ? { mode, value: Math.min(100, Math.round(v * 100) / 100) } : { mode, value: Math.round(v) };
}

type InLine = CreateOrderInput["lines"][number];
type Built = { item: typeof menuItems.$inferSelect; qty: number; note: string; options: { name: string; price: number }[]; discount: Discount };

/** Validasi baris pesanan terhadap database (menu, stok, varian wajib). Dipakai pesanan baru dan tambahan pesanan. */
async function buildLines(userId: string, lines: InLine[]): Promise<{ ok: true; built: Built[]; items: (typeof menuItems.$inferSelect)[]; qtyByItem: Map<string, number> } | { ok: false; error: string }> {
  if (!lines?.length || lines.length > 100) return { ok: false, error: "Pesanan masih kosong." };
  const ids = [...new Set(lines.map((l) => l.menuItemId))];
  const items = await db().select().from(menuItems).where(and(eq(menuItems.userId, userId), inArray(menuItems.id, ids)));
  if (items.length !== ids.length) return { ok: false, error: "Ada menu yang sudah dihapus. Muat ulang halaman lalu coba lagi." };
  const links = await db().select().from(menuItemVariantGroups).where(inArray(menuItemVariantGroups.menuItemId, ids));
  const groupIds = [...new Set(links.map((l) => l.groupId))];
  const groups = groupIds.length ? await db().select().from(variantGroups).where(inArray(variantGroups.id, groupIds)) : [];
  const opts = groupIds.length ? await db().select().from(variantOptions).where(inArray(variantOptions.groupId, groupIds)) : [];

  const qtyByItem = new Map<string, number>();
  const built: Built[] = [];
  for (const l of lines) {
    const item = items.find((i) => i.id === l.menuItemId)!;
    const qty = Math.round(Number(l.qty));
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) return { ok: false, error: "Jumlah item tidak valid." };
    if (item.soldOut || (!item.unlimitedStock && item.stock <= 0)) return { ok: false, error: `${item.name} sedang habis.` };
    qtyByItem.set(item.id, (qtyByItem.get(item.id) ?? 0) + qty);

    const itemGroups = links.filter((x) => x.menuItemId === item.id).map((x) => groups.find((g) => g.id === x.groupId)!).filter(Boolean);
    const chosen = [...new Set(l.optionIds ?? [])].map((oid) => opts.find((o) => o.id === oid));
    const picked: { name: string; price: number }[] = [];
    for (const o of chosen) {
      if (!o || !itemGroups.some((g) => g.id === o.groupId)) return { ok: false, error: `Pilihan varian ${item.name} tidak valid.` };
      picked.push({ name: o.name, price: o.price });
    }
    for (const g of itemGroups) {
      const n = chosen.filter((o) => o?.groupId === g.id).length;
      if (g.required && n !== 1) return { ok: false, error: `Pilih satu ${g.name} untuk ${item.name}.` };
    }
    built.push({ item, qty, note: String(l.note ?? "").trim().slice(0, 200), options: picked, discount: cleanDiscount(l.discount) });
  }
  for (const [mid, q] of qtyByItem) {
    const it = items.find((i) => i.id === mid)!;
    if (!it.unlimitedStock && q > it.stock) return { ok: false, error: `Stok ${it.name} tinggal ${it.stock}.` };
  }
  return { ok: true, built, items, qtyByItem };
}

/** Harga selalu dihitung ulang dari database, bukan dari angka yang dikirim browser. */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const u = await requireUser();
  const orderType = TYPES.includes(input.orderType) ? input.orderType : "Makan di tempat";
  const v = await buildLines(u.id, input.lines);
  if (!v.ok) return fail(v.error);
  const { built, items, qtyByItem } = v;

  const orderDiscount = cleanDiscount(input.discount);
  const T = calcOrder(
    built.map((b) => ({ price: b.item.price, optionsTotal: b.options.reduce((s, o) => s + o.price, 0), qty: b.qty, discount: b.discount })),
    orderDiscount,
  );

  const p = input.payment;
  let status: "paid" | "unpaid" = "paid";
  let cashReceived = 0, change = 0;
  const pay: { method: "cash" | "qris"; amount: number }[] = [];
  if (p.kind === "later") status = "unpaid";
  else if (p.kind === "cash") {
    cashReceived = Math.round(Number(p.received));
    if (!(cashReceived >= T.total)) return fail("Uang yang diterima kurang dari total.");
    change = cashReceived - T.total;
    pay.push({ method: "cash", amount: T.total });
  } else if (p.kind === "qris") {
    if (!u.qrisImage) return fail("QRIS belum diupload di Pengaturan.");
    pay.push({ method: "qris", amount: T.total });
  } else if (p.kind === "split") {
    if (!u.qrisImage) return fail("QRIS belum diupload di Pengaturan.");
    const c = Math.round(Number(p.cash));
    if (!(c > 0 && c < T.total)) return fail("Nominal tunai harus lebih kecil dari total.");
    cashReceived = c;
    pay.push({ method: "cash", amount: c }, { method: "qris", amount: T.total - c });
  } else return fail("Metode pembayaran tidak dikenal.");

  const customerName = String(input.customerName ?? "").trim().slice(0, 60);
  for (let attempt = 0; attempt < 2; attempt++) {
    const [m] = await db().select({ m: max(orders.number) }).from(orders).where(eq(orders.userId, u.id));
    const number = (m.m ?? 0) + 1;
    const orderId = crypto.randomUUID();
    const now = new Date();
    // Semua perintah di bawah dijalankan sebagai satu transaksi: gagal satu, gagal semua.
    const q: any[] = [
      db().insert(orders).values({
        id: orderId, userId: u.id, number, createdAt: now, customerName, orderType, tableNo: String(input.tableNo ?? "").trim().slice(0, 20),
        subtotal: T.subtotal, itemDiscount: T.itemDiscount, orderDiscountMode: orderDiscount.mode, orderDiscountValue: orderDiscount.value,
        orderDiscount: T.orderDiscount, total: T.total, status, paidAt: status === "paid" ? now : null,
        wasPayLater: status === "unpaid", cashReceived, changeGiven: change,
      }),
      db().insert(orderItems).values(built.map((b) => ({
        orderId, menuItemId: b.item.id, name: b.item.name, price: b.item.price, qty: b.qty, note: b.note,
        options: b.options, discountMode: b.discount.mode, discountValue: b.discount.value,
      }))),
    ];
    if (pay.length) q.push(db().insert(payments).values(pay.map((x) => ({ orderId, method: x.method, amount: x.amount }))));
    for (const [mid, qty] of qtyByItem) {
      const it = items.find((i) => i.id === mid)!;
      if (!it.unlimitedStock) q.push(db().update(menuItems).set({ stock: sql`GREATEST(${menuItems.stock} - ${qty}, 0)` }).where(eq(menuItems.id, mid)));
    }
    try {
      await db().batch(q as [any, ...any[]]);
      revalidatePath("/", "layout");
      return { ok: true, order: { id: orderId, number, total: T.total, change, status, customerName } };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (attempt === 0 && /orders_user_number_uq|duplicate key/i.test(msg)) continue;
      return fail("Pesanan gagal disimpan. Coba lagi.");
    }
  }
  return fail("Pesanan gagal disimpan. Coba lagi.");
}

/* ---------- struk dan pelunasan ---------- */
export async function getReceipt(orderId: string): Promise<ReceiptDTO | null> {
  const u = await requireUser();
  return loadReceipt(u.id, orderId);
}

export async function settleOrder(orderId: string, p: SettleInput): Promise<ActionResult> {
  const u = await requireUser();
  const [o] = await db().select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, u.id))).limit(1);
  if (!o) return { ok: false, error: "Pesanan tidak ditemukan." };
  if (o.status !== "unpaid") return { ok: false, error: "Pesanan ini sudah lunas." };

  let cashReceived = 0, change = 0;
  const pay: { method: "cash" | "qris"; amount: number }[] = [];
  if (p.kind === "cash") {
    cashReceived = Math.round(Number(p.received));
    if (!(cashReceived >= o.total)) return { ok: false, error: "Uang yang diterima kurang dari total." };
    change = cashReceived - o.total;
    pay.push({ method: "cash", amount: o.total });
  } else if (p.kind === "qris") {
    if (!u.qrisImage) return { ok: false, error: "QRIS belum diupload di Pengaturan." };
    pay.push({ method: "qris", amount: o.total });
  } else if (p.kind === "split") {
    if (!u.qrisImage) return { ok: false, error: "QRIS belum diupload di Pengaturan." };
    const c = Math.round(Number(p.cash));
    if (!(c > 0 && c < o.total)) return { ok: false, error: "Nominal tunai harus lebih kecil dari total." };
    cashReceived = c;
    pay.push({ method: "cash", amount: c }, { method: "qris", amount: o.total - c });
  } else return { ok: false, error: "Metode pembayaran tidak dikenal." };

  const q: any[] = [
    db().insert(payments).values(pay.map((x) => ({ orderId, method: x.method, amount: x.amount }))),
    db().update(orders).set({ status: "paid", paidAt: new Date(), cashReceived, changeGiven: change })
      .where(and(eq(orders.id, orderId), eq(orders.userId, u.id), eq(orders.status, "unpaid"))),
  ];
  try { await db().batch(q as [any, ...any[]]); } catch { return { ok: false, error: "Pelunasan gagal disimpan. Coba lagi." }; }
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- bayar nanti: tambah menu dan bayar sebagian ---------- */
const asDisc = (mode: string, value: number): Discount => ({ mode: mode === "pct" ? "pct" : "rp", value });
const toSplit = (i: typeof orderItems.$inferSelect): SplitLine => ({
  id: i.id, price: i.price, optionsTotal: i.options.reduce((a, o) => a + o.price, 0), qty: i.qty, discount: asDisc(i.discountMode, i.discountValue),
});

/** Menambah menu ke pesanan yang belum lunas. Total dihitung ulang termasuk diskon pesanan yang sudah ada. */
export async function addItemsToOrder(orderId: string, lines: CreateOrderInput["lines"]): Promise<AddItemsResult> {
  const u = await requireUser();
  const [o] = await db().select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, u.id))).limit(1);
  if (!o) return { ok: false, error: "Pesanan tidak ditemukan." };
  if (o.status !== "unpaid") return { ok: false, error: "Pesanan ini sudah lunas, tidak bisa ditambah." };
  const v = await buildLines(u.id, lines);
  if (!v.ok) return v;

  const existing = await db().select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const disc = asDisc(o.orderDiscountMode, o.orderDiscountValue);
  const T = calcOrder([
    ...existing.map(toSplit),
    ...v.built.map((b) => ({ price: b.item.price, optionsTotal: b.options.reduce((a, x) => a + x.price, 0), qty: b.qty, discount: b.discount })),
  ], disc);

  const q: any[] = [
    db().insert(orderItems).values(v.built.map((b) => ({
      orderId, menuItemId: b.item.id, name: b.item.name, price: b.item.price, qty: b.qty, note: b.note,
      options: b.options, discountMode: b.discount.mode, discountValue: b.discount.value,
    }))),
    db().update(orders).set({ subtotal: T.subtotal, itemDiscount: T.itemDiscount, orderDiscount: T.orderDiscount, total: T.total })
      .where(and(eq(orders.id, orderId), eq(orders.userId, u.id), eq(orders.status, "unpaid"))),
  ];
  for (const [mid, qty] of v.qtyByItem) {
    const it = v.items.find((i) => i.id === mid)!;
    if (!it.unlimitedStock) q.push(db().update(menuItems).set({ stock: sql`GREATEST(${menuItems.stock} - ${qty}, 0)` }).where(eq(menuItems.id, mid)));
  }
  try { await db().batch(q as [any, ...any[]]); } catch { return { ok: false, error: "Tambahan gagal disimpan. Coba lagi." }; }
  revalidatePath("/", "layout");
  return { ok: true, number: o.number, total: T.total };
}

/** Isi pesanan belum lunas, untuk memilih item yang dibayar sekarang. */
export async function getOrderLines(orderId: string): Promise<OrderLinesDTO | null> {
  const u = await requireUser();
  const [o] = await db().select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, u.id), eq(orders.status, "unpaid"))).limit(1);
  if (!o) return null;
  const its = await db().select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return {
    id: o.id, number: o.number, customerName: o.customerName, discount: asDisc(o.orderDiscountMode, o.orderDiscountValue),
    lines: its.map((i) => ({
      id: i.id, name: i.name, options: i.options.map((x) => x.name), note: i.note, price: i.price,
      optionsTotal: i.options.reduce((a, x) => a + x.price, 0), qty: i.qty, discount: asDisc(i.discountMode, i.discountValue),
    })),
  };
}

/**
 * Satu orang membayar bagiannya dulu: item yang dipilih dipindah ke pesanan baru yang langsung lunas,
 * sisanya tetap di pesanan awal (belum lunas). Jika semua item dipilih, pesanan dilunasi seperti biasa.
 */
export async function payPartial(orderId: string, picks: { itemId: string; qty: number }[], p: SettleInput): Promise<PartialResult> {
  const u = await requireUser();
  const [o] = await db().select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, u.id))).limit(1);
  if (!o) return { ok: false, error: "Pesanan tidak ditemukan." };
  if (o.status !== "unpaid") return { ok: false, error: "Pesanan ini sudah lunas." };
  const its = await db().select().from(orderItems).where(eq(orderItems.orderId, orderId));

  const sel = new Map<string, number>();
  for (const k of picks ?? []) {
    const it = its.find((x) => x.id === k.itemId);
    const qty = Math.round(Number(k.qty));
    if (!it || !Number.isInteger(qty) || qty < 0 || qty > it.qty || sel.has(k.itemId)) return { ok: false, error: "Pilihan item tidak valid." };
    if (qty > 0) sel.set(k.itemId, qty);
  }
  if (!sel.size) return { ok: false, error: "Pilih minimal satu item yang dibayar." };
  if (its.every((i) => sel.get(i.id) === i.qty)) {
    const r = await settleOrder(orderId, p);
    return r.ok ? { ok: true, orderId, number: o.number, remaining: 0 } : r;
  }

  const S = splitOrder(its.map(toSplit), asDisc(o.orderDiscountMode, o.orderDiscountValue), sel);
  const total = S.paid.calc.total;

  let cashReceived = 0, change = 0;
  const pay: { method: "cash" | "qris"; amount: number }[] = [];
  if (p.kind === "cash") {
    cashReceived = Math.round(Number(p.received));
    if (!(cashReceived >= total)) return { ok: false, error: "Uang yang diterima kurang dari total." };
    change = cashReceived - total;
    pay.push({ method: "cash", amount: total });
  } else if (p.kind === "qris") {
    if (!u.qrisImage) return { ok: false, error: "QRIS belum diupload di Pengaturan." };
    pay.push({ method: "qris", amount: total });
  } else if (p.kind === "split") {
    if (!u.qrisImage) return { ok: false, error: "QRIS belum diupload di Pengaturan." };
    const c = Math.round(Number(p.cash));
    if (!(c > 0 && c < total)) return { ok: false, error: "Nominal tunai harus lebih kecil dari total." };
    cashReceived = c;
    pay.push({ method: "cash", amount: c }, { method: "qris", amount: total - c });
  } else return { ok: false, error: "Metode pembayaran tidak dikenal." };

  for (let attempt = 0; attempt < 2; attempt++) {
    const [m] = await db().select({ m: max(orders.number) }).from(orders).where(eq(orders.userId, u.id));
    const number = (m.m ?? 0) + 1;
    const newId = crypto.randomUUID();
    const now = new Date();
    const byId = new Map(its.map((i) => [i.id, i]));
    const q: any[] = [
      db().insert(orders).values({
        id: newId, userId: u.id, number, createdAt: now, customerName: o.customerName, orderType: o.orderType, tableNo: o.tableNo,
        subtotal: S.paid.calc.subtotal, itemDiscount: S.paid.calc.itemDiscount, orderDiscountMode: S.paid.discount.mode, orderDiscountValue: S.paid.discount.value,
        orderDiscount: S.paid.calc.orderDiscount, total, status: "paid", paidAt: now, wasPayLater: true, cashReceived, changeGiven: change,
      }),
      db().insert(orderItems).values(S.paid.lines.map((l) => {
        const src = byId.get(l.id)!;
        return { orderId: newId, menuItemId: src.menuItemId, name: src.name, price: src.price, qty: l.qty, note: src.note, options: src.options, discountMode: l.discount.mode, discountValue: l.discount.value };
      })),
      db().insert(payments).values(pay.map((x) => ({ orderId: newId, method: x.method, amount: x.amount }))),
    ];
    // Sisa pesanan: hapus baris yang dibayar penuh, kurangi jumlah baris yang dibayar sebagian.
    for (const l of S.remain.lines) {
      const src = byId.get(l.id)!;
      if (l.qty !== src.qty || l.discount.value !== src.discountValue) {
        q.push(db().update(orderItems).set({ qty: l.qty, discountValue: l.discount.value }).where(eq(orderItems.id, l.id)));
      }
    }
    const keep = new Set(S.remain.lines.map((l) => l.id));
    const gone = its.filter((i) => !keep.has(i.id)).map((i) => i.id);
    if (gone.length) q.push(db().delete(orderItems).where(inArray(orderItems.id, gone)));
    q.push(db().update(orders).set({
      subtotal: S.remain.calc.subtotal, itemDiscount: S.remain.calc.itemDiscount, orderDiscountValue: S.remain.discount.value,
      orderDiscount: S.remain.calc.orderDiscount, total: S.remain.calc.total,
    }).where(and(eq(orders.id, orderId), eq(orders.userId, u.id), eq(orders.status, "unpaid"))));
    try {
      await db().batch(q as [any, ...any[]]);
      revalidatePath("/", "layout");
      return { ok: true, orderId: newId, number, remaining: S.remain.calc.total };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (attempt === 0 && /orders_user_number_uq|duplicate key/i.test(msg)) continue;
      return { ok: false, error: "Pembayaran gagal disimpan. Coba lagi." };
    }
  }
  return { ok: false, error: "Pembayaran gagal disimpan. Coba lagi." };
}
