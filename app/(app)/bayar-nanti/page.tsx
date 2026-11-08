import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { loadOrderRows } from "@/lib/orders";
import { BayarNanti } from "@/components/BayarNanti";

export const metadata: Metadata = { title: "Bayar nanti" };

export default async function Page() {
  const u = await requireUser();
  const [orders, [qr]] = await Promise.all([
    loadOrderRows(u.id, { onlyPayLater: true, limit: 300 }),
    db().select({ v: sql<string | null>`case when ${users.qrisImage} = '' then null else left(md5(${users.qrisImage}), 8) end` }).from(users).where(eq(users.id, u.id)),
  ]);
  return <BayarNanti orders={orders} qrisUrl={qr.v ? `/api/qris?v=${qr.v}` : null} />;
}
