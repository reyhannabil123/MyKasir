"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { cashClosings, expenses, orders, payments } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { startOfTodayWIB } from "@/lib/time";
import type { ActionResult } from "@/lib/types";

const done = (): ActionResult => { revalidatePath("/", "layout"); return { ok: true }; };

export async function addExpense(input: { name: string; amount: number }): Promise<ActionResult> {
  const u = await requireUser();
  const name = String(input.name ?? "").trim().slice(0, 80);
  const amount = Math.round(Number(input.amount));
  if (!name) return { ok: false, error: "Isi keterangan pengeluaran." };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return { ok: false, error: "Isi nominal pengeluaran dengan benar." };
  await db().insert(expenses).values({ userId: u.id, name, amount });
  return done();
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const u = await requireUser();
  await db().delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, u.id)));
  return done();
}

/** Uang tunai yang seharusnya ada = kas awal + penjualan tunai hari ini - pengeluaran dari laci. Dihitung di server. */
export async function saveClosing(input: { opening: number; counted: number; drawerExpenses: number }): Promise<ActionResult> {
  const u = await requireUser();
  const opening = Math.round(Number(input.opening)), counted = Math.round(Number(input.counted)), drawer = Math.max(0, Math.round(Number(input.drawerExpenses) || 0));
  if (![opening, counted].every((n) => Number.isFinite(n) && n >= 0)) return { ok: false, error: "Isi kas awal dan uang yang dihitung." };
  const from = startOfTodayWIB(), to = new Date(from.getTime() + 86_400_000);
  const rows = await db().select({ amount: payments.amount }).from(payments).innerJoin(orders, eq(payments.orderId, orders.id))
    .where(and(eq(orders.userId, u.id), eq(orders.status, "paid"), eq(payments.method, "cash"), gte(orders.paidAt, from), lt(orders.paidAt, to)));
  const cash = rows.reduce((s, r) => s + r.amount, 0);
  await db().insert(cashClosings).values({ userId: u.id, openingCash: opening, expectedCash: opening + cash - drawer, countedCash: counted });
  return done();
}
