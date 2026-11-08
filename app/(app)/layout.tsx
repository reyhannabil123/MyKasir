import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";
import { redirect } from "next/navigation";
import { requireUser, sessionUserId } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const uid = await sessionUserId();
  if (!uid) redirect("/login");
  // Ambil profil dan jumlah "bayar nanti" bersamaan, bukan bergantian.
  const [u, [{ n }]] = await Promise.all([
    requireUser(),
    db().select({ n: count() }).from(orders).where(and(eq(orders.userId, uid), eq(orders.status, "unpaid"))),
  ]);
  return (
    <div className="app">
      <Nav shop={u.shopName} unpaid={n} />
      <main className="view">{children}</main>
    </div>
  );
}
