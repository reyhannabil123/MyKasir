import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq, max, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, users } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { loadMenu } from "@/lib/menu";
import { OrderScreen } from "@/components/OrderScreen";

export const metadata: Metadata = { title: "Pesanan" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tambah?: string }> }) {
  const u = await requireUser();
  const tambah = (await searchParams).tambah;
  const [data, [n], [qr]] = await Promise.all([
    loadMenu(u.id),
    db().select({ m: max(orders.number) }).from(orders).where(eq(orders.userId, u.id)),
    db().select({ v: sql<string | null>`case when ${users.qrisImage} = '' then null else left(md5(${users.qrisImage}), 8) end` }).from(users).where(eq(users.id, u.id)),
  ]);
  let append;
  if (tambah) {
    const ok = /^[0-9a-f-]{36}$/i.test(tambah);
    const [o] = ok ? await db().select().from(orders).where(and(eq(orders.id, tambah), eq(orders.userId, u.id), eq(orders.status, "unpaid"))).limit(1) : [];
    if (!o) redirect("/bayar-nanti");
    append = { id: o.id, number: o.number, customerName: o.customerName, total: o.total };
  }
  return <OrderScreen data={data} qrisUrl={qr.v ? `/api/qris?v=${qr.v}` : null} nextNumber={(n.m ?? 0) + 1} append={append} />;
}
