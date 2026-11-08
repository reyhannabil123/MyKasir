import { and, desc, eq, gte, inArray, type SQL } from "drizzle-orm";
import { db } from "./db";
import { orderItems, orders, payments, users } from "./schema";
import type { OrderRowDTO, ReceiptDTO } from "./types";

export async function loadOrderRows(userId: string, o: { since?: Date; onlyPayLater?: boolean; limit?: number } = {}, conn = db()): Promise<OrderRowDTO[]> {
  const where: SQL[] = [eq(orders.userId, userId)];
  if (o.since) where.push(gte(orders.createdAt, o.since));
  if (o.onlyPayLater) where.push(eq(orders.wasPayLater, true));
  const rows = await conn.select().from(orders).where(and(...where)).orderBy(desc(orders.createdAt)).limit(o.limit ?? 300);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [its, pays] = await Promise.all([
    conn.select().from(orderItems).where(inArray(orderItems.orderId, ids)),
    conn.select().from(payments).where(inArray(payments.orderId, ids)),
  ]);
  return rows.map((r) => ({
    id: r.id, number: r.number, createdAt: r.createdAt.toISOString(), paidAt: r.paidAt?.toISOString() ?? null,
    customerName: r.customerName, orderType: r.orderType, tableNo: r.tableNo, total: r.total,
    status: r.status as "paid" | "unpaid", wasPayLater: r.wasPayLater,
    methods: [...new Set(pays.filter((p) => p.orderId === r.id).map((p) => p.method as "cash" | "qris"))],
    itemsText: its.filter((i) => i.orderId === r.id).map((i) => `${i.qty}× ${i.name}`).join(", "),
  }));
}

export async function loadReceipt(userId: string, orderId: string, conn = db()): Promise<ReceiptDTO | null> {
  const [o] = await conn.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  if (!o) return null;
  const [[u], its, pays] = await Promise.all([
    conn.select().from(users).where(eq(users.id, userId)).limit(1),
    conn.select().from(orderItems).where(eq(orderItems.orderId, o.id)),
    conn.select().from(payments).where(eq(payments.orderId, o.id)),
  ]);
  return {
    shop: u.shopName, address: u.address, whatsapp: u.whatsapp, footer: u.receiptFooter, paperWidth: u.paperWidth,
    number: o.number, createdAt: o.createdAt.toISOString(), customerName: o.customerName, orderType: o.orderType, tableNo: o.tableNo,
    items: its.map((i) => {
      const base = (i.price + i.options.reduce((s, x) => s + x.price, 0)) * i.qty;
      const d = i.discountMode === "pct" ? (base * Math.min(100, i.discountValue)) / 100 : i.discountValue;
      return { qty: i.qty, name: i.name, options: i.options, note: i.note, base, discount: Math.round(Math.min(base, Math.max(0, d))) };
    }),
    subtotal: o.subtotal, orderDiscount: o.orderDiscount, total: o.total, status: o.status as "paid" | "unpaid",
    payments: pays.map((p) => ({ method: p.method as "cash" | "qris", amount: p.amount })), cashReceived: o.cashReceived, change: o.changeGiven,
  };
}
