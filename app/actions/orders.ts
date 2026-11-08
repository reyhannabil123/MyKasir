"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { menuItems, menuItemVariantGroups, orderItems, orders, payments, variantGroups, variantOptions } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { calcOrder, type Discount } from "@/lib/calc";
import { loadReceipt } from "@/lib/orders";
import type { ActionResult, CreateOrderInput, CreateOrderResult, ReceiptDTO, SettleInput } from "@/lib/types";

const fail = (error: string): CreateOrderResult => ({ ok: false, error });
const TYPES = ["Makan di tempat", "Bawa pulang", "Ojol"];

function cleanDiscount(d: Discount | undefined): Discount {
  const mode = d?.mode === "pct" ? "pct" : "rp";
  const v = Number(d?.value);
  if (!Number.isFinite(v) || v <= 0) return { mode, value: 0 };
  return mode === "pct" ? { mode, value: Math.min(100, Math.round(v * 100) / 100) } : { mode, value: Math.round(v) };
}

/** Harga selalu dihitung ulang dari database, bukan dari angka yang dikirim browser. */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const u = await requireUser();
  if (!input.lines?.length || input.lines.length > 100) return fail("Pesanan masih kosong.");
  const orderType = TYPES.includes(input.orderType) ? input.orderType : "Makan di tempat";

  const ids = [...new Set(input.lines.map((l) => l.menuItemId))];
  const items = await db().select().from(menuItems).where(and(eq(menuItems.userId, u.id), inArray(menuItems.id, ids)));
  if (items.length !== ids.length) return fail("Ada menu yang sudah dihapus. Muat ulang halaman lalu coba lagi.");
  const links = await db().select().from(menuItemVariantGroups).where(inArray(menuItemVariantGroups.menuItemId, ids));
  const groupIds = [...new Set(links.map((l) => l.groupId))];
  const groups = groupIds.length ? await db().select().from(variantGroups).where(inArray(variantGroups.id, groupIds)) : [];
  const opts = groupIds.length ? await db().select().from(variantOptions).where(inArray(variantOptions.groupId, groupIds)) : [];

  const qtyByItem = new Map<string, number>();
  const built = [];
  for (const l of input.lines) {
    const item = items.find((i) => i.id === l.menuItemId)!;
    const qty = Math.round(Number(l.qty));
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) return fail("Jumlah item tidak valid.");
    if (item.soldOut || (!item.unlimitedStock && item.stock <= 0)) return fail(`${item.name} sedang habis.`);
    qtyByItem.set(item.id, (qtyByItem.get(item.id) ?? 0) + qty);

    const itemGroups = links.filter((x) => x.menuItemId === item.id).map((x) => groups.find((g) => g.id === x.groupId)!).filter(Boolean);
    const chosen = [...new Set(l.optionIds ?? [])].map((oid) => opts.find((o) => o.id === oid));
    const picked: { name: string; price: number }[] = [];
    for (const o of chosen) {
      if (!o || !itemGroups.some((g) => g.id === o.groupId)) return fail(`Pilihan varian ${item.name} tidak valid.`);
      picked.push({ name: o.name, price: o.price });
    }
    for (const g of itemGroups) {
      const n = chosen.filter((o) => o?.groupId === g.id).length;
      if (g.required && n !== 1) return fail(`Pilih satu ${g.name} untuk ${item.name}.`);
    }
    built.push({ item, qty, note: String(l.note ?? "").trim().slice(0, 200), options: picked, discount: cleanDiscount(l.discount) });
  }
  for (const [mid, q] of qtyByItem) {
    const it = items.find((i) => i.id === mid)!;
    if (!it.unlimitedStock && q > it.stock) return fail(`Stok ${it.name} tinggal ${it.stock}.`);
  }

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
