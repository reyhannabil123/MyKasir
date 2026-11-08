import Link from "next/link";
import { and, count, eq, gte, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { rupiah, startOfTodayWIB } from "@/lib/time";
import { loadOrderRows } from "@/lib/orders";
import { OrderList } from "@/components/OrderList";

export default async function Home() {
  const u = await requireUser();
  const since = startOfTodayWIB();
  const [paid] = await db().select({ n: count(), total: sum(orders.total) }).from(orders)
    .where(and(eq(orders.userId, u.id), eq(orders.status, "paid"), gte(orders.paidAt, since)));
  const [unpaid] = await db().select({ n: count(), total: sum(orders.total) }).from(orders)
    .where(and(eq(orders.userId, u.id), eq(orders.status, "unpaid")));
  const recent = await loadOrderRows(u.id, { limit: 5 });

  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()));
  const sapa = h < 11 ? "pagi" : h < 15 ? "siang" : h < 18 ? "sore" : "malam";
  const tanggal = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date());

  return (
    <div className="stack-lg">
      <header className="ph"><div><h1>Selamat {sapa}</h1><p className="sub">{tanggal} · {u.shopName}</p></div></header>
      <div className="hero">
        <div><h2>Ada pembeli?</h2><p style={{ opacity: 0.85 }}>Mulai pesanan baru dalam satu ketukan.</p></div>
        <Link className="btn" href="/pesanan">Pesanan baru</Link>
      </div>
      <div className="stats">
        <div className="stat"><span>Omzet hari ini</span><b>{rupiah(Number(paid.total ?? 0))}</b></div>
        <div className="stat"><span>Pesanan lunas</span><b>{paid.n}</b></div>
        <div className="stat"><span>Belum dibayar</span><b>{rupiah(Number(unpaid.total ?? 0))}</b></div>
      </div>
      <section className="stack">
        <div className="row sb"><h2>Pesanan terakhir</h2><Link className="btn sm ghost" href="/riwayat">Lihat semua</Link></div>
        <OrderList orders={recent} empty="Belum ada pesanan. Tambahkan menu dulu, lalu buat pesanan pertama." />
      </section>
    </div>
  );
}
