"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const ITEMS = [
  { href: "/", label: "Beranda", icon: "home" as const },
  { href: "/menu", label: "Menu", icon: "menu" as const },
  { href: "/bayar-nanti", label: "Bayar nanti", icon: "clock" as const },
  { href: "/laporan", label: "Laporan", icon: "chart" as const },
];

export function Nav({ shop, unpaid }: { shop: string; unpaid: number }) {
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === "/" : h === "/laporan" ? path.startsWith("/laporan") || path.startsWith("/riwayat") : path.startsWith(h));
  const badge = unpaid > 0 ? <span className="nbadge">{unpaid}</span> : null;
  const hide = path.startsWith("/pesanan");
  return (
    <>
      <aside className="side">
        <div className="brand"><span className="logo">M</span>MyKasir</div>
        <p className="shopname">{shop}</p>
        <Link className="btn newbtn" href="/pesanan"><Icon n="plus" /> Pesanan baru</Link>
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={`nav ${on(i.href) ? "on" : ""}`}>
            <Icon n={i.icon} />{i.label}{i.href === "/bayar-nanti" && badge}
          </Link>
        ))}
        <span className="sp" />
        <Link href="/pengaturan" className={`nav ${on("/pengaturan") ? "on" : ""}`}><Icon n="gear" />Pengaturan</Link>
      </aside>
      {!hide && (
        <nav className="bottom">
          {ITEMS.slice(0, 2).map((i) => (
            <Link key={i.href} href={i.href} className={on(i.href) ? "on" : ""}><Icon n={i.icon} s={22} />{i.label}</Link>
          ))}
          <Link href="/pesanan" className="fab" aria-label="Pesanan baru"><Icon n="plus" s={30} /></Link>
          {ITEMS.slice(2).map((i) => (
            <Link key={i.href} href={i.href} className={on(i.href) ? "on" : ""}>
              <Icon n={i.icon} s={22} />{i.label}{i.href === "/bayar-nanti" && badge}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
