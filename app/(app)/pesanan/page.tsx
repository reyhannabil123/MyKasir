import type { Metadata } from "next";
import { eq, max, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, users } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { loadMenu } from "@/lib/menu";
import { OrderScreen } from "@/components/OrderScreen";

export const metadata: Metadata = { title: "Pesanan baru" };

export default async function Page() {
  const u = await requireUser();
  const [data, [n], [qr]] = await Promise.all([
    loadMenu(u.id),
    db().select({ m: max(orders.number) }).from(orders).where(eq(orders.userId, u.id)),
    db().select({ v: sql<string | null>`case when ${users.qrisImage} = '' then null else left(md5(${users.qrisImage}), 8) end` }).from(users).where(eq(users.id, u.id)),
  ]);
  return <OrderScreen data={data} qrisUrl={qr.v ? `/api/qris?v=${qr.v}` : null} nextNumber={(n.m ?? 0) + 1} />;
}
