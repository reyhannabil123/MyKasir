import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "./db";
import { cashClosings, expenses, orderItems, orders, payments } from "./schema";
import { wibDay } from "./range";

export type ReportDTO = {
  from: string; to: string;
  count: number; omzet: number; discount: number; cash: number; qris: number; expenses: number; profit: number;
  unpaid: { count: number; total: number };
  top: { name: string; qty: number; revenue: number }[];
  daily: { date: string; count: number; total: number }[];
  orders: { number: number; paidAt: string; customerName: string; orderType: string; subtotal: number; discount: number; total: number; methods: string }[];
  expenseList: { id: string; name: string; amount: number; createdAt: string }[];
};

export async function loadReport(userId: string, from: Date, to: Date, conn = db()): Promise<ReportDTO> {
  const paid = await conn.select().from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, "paid"), gte(orders.paidAt, from), lt(orders.paidAt, to))).orderBy(desc(orders.paidAt));
  const ids = paid.map((o) => o.id);
  const [its, pays, exp, unpaid] = await Promise.all([
    ids.length ? conn.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : Promise.resolve([]),
    ids.length ? conn.select().from(payments).where(inArray(payments.orderId, ids)) : Promise.resolve([]),
    conn.select().from(expenses).where(and(eq(expenses.userId, userId), gte(expenses.createdAt, from), lt(expenses.createdAt, to))).orderBy(desc(expenses.createdAt)),
    conn.select({ total: orders.total }).from(orders).where(and(eq(orders.userId, userId), eq(orders.status, "unpaid"))),
  ]);

  let cash = 0, qris = 0;
  for (const p of pays) p.method === "qris" ? (qris += p.amount) : (cash += p.amount);

  const byName = new Map<string, { qty: number; revenue: number }>();
  for (const i of its) {
    const base = (i.price + i.options.reduce((s, x) => s + x.price, 0)) * i.qty;
    const d = i.discountMode === "pct" ? (base * Math.min(100, i.discountValue)) / 100 : i.discountValue;
    const net = base - Math.round(Math.min(base, Math.max(0, d)));
    const cur = byName.get(i.name) ?? { qty: 0, revenue: 0 };
    byName.set(i.name, { qty: cur.qty + i.qty, revenue: cur.revenue + net });
  }
  const daily = new Map<string, { count: number; total: number }>();
  for (const o of paid) {
    const k = wibDay(o.paidAt!), cur = daily.get(k) ?? { count: 0, total: 0 };
    daily.set(k, { count: cur.count + 1, total: cur.total + o.total });
  }
  const omzet = paid.reduce((s, o) => s + o.total, 0);
  const expTotal = exp.reduce((s, e) => s + e.amount, 0);
  return {
    from: from.toISOString(), to: to.toISOString(), count: paid.length, omzet,
    discount: paid.reduce((s, o) => s + o.itemDiscount + o.orderDiscount, 0), cash, qris, expenses: expTotal, profit: omzet - expTotal,
    unpaid: { count: unpaid.length, total: unpaid.reduce((s, o) => s + o.total, 0) },
    top: [...byName].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 10),
    daily: [...daily].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    orders: paid.map((o) => ({
      number: o.number, paidAt: o.paidAt!.toISOString(), customerName: o.customerName, orderType: o.orderType, subtotal: o.subtotal,
      discount: o.itemDiscount + o.orderDiscount, total: o.total,
      methods: [...new Set(pays.filter((p) => p.orderId === o.id).map((p) => (p.method === "qris" ? "QRIS" : "Tunai")))].join(" + "),
    })),
    expenseList: exp.map((e) => ({ id: e.id, name: e.name, amount: e.amount, createdAt: e.createdAt.toISOString() })),
  };
}

export type ClosingDTO = { id: string; createdAt: string; openingCash: number; expectedCash: number; countedCash: number };
export async function loadClosings(userId: string, conn = db()): Promise<ClosingDTO[]> {
  const rows = await conn.select().from(cashClosings).where(eq(cashClosings.userId, userId)).orderBy(desc(cashClosings.createdAt)).limit(14);
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), openingCash: r.openingCash, expectedCash: r.expectedCash, countedCash: r.countedCash }));
}
