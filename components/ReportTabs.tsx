import Link from "next/link";
import { PERIODES, type Periode } from "@/lib/range";

const TABS = [
  { href: "/laporan", label: "Ringkasan" }, { href: "/riwayat", label: "Riwayat" },
  { href: "/laporan/pengeluaran", label: "Pengeluaran" }, { href: "/laporan/tutup-kasir", label: "Tutup kasir" },
];

export function ReportTabs({ active }: { active: string }) {
  return (
    <div className="chips" role="tablist" aria-label="Bagian laporan">
      {TABS.map((t) => <Link key={t.href} href={t.href} role="tab" aria-selected={active === t.href} className={`chip ${active === t.href ? "on" : ""}`}>{t.label}</Link>)}
    </div>
  );
}

export function PeriodTabs({ base, current, only }: { base: string; current: Periode; only?: Periode[] }) {
  return (
    <div className="seg">
      {PERIODES.filter((p) => !only || only.includes(p.key)).map((p) => (
        <Link key={p.key} href={`${base}?periode=${p.key}`} replace scroll={false} className={`segl ${current === p.key ? "on" : ""}`}>{p.label}</Link>
      ))}
    </div>
  );
}
