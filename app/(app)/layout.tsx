import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const [{ n }] = await db().select({ n: count() }).from(orders)
    .where(and(eq(orders.userId, u.id), eq(orders.status, "unpaid")));
  return (
    <div className="app">
      <Nav shop={u.shopName} unpaid={n} />
      <main className="view">{children}</main>
    </div>
  );
}
