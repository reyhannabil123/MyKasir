import { fmtDate, fmtTime, pad } from "@/lib/format";
import type { ReceiptDTO } from "@/lib/types";

const n = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const Row = ({ a, b, cls = "" }: { a: React.ReactNode; b: React.ReactNode; cls?: string }) => (
  <div className={`rr ${cls}`}><span>{a}</span><span>{b}</span></div>
);

export function Receipt({ r }: { r: ReceiptDTO }) {
  const single = r.payments.length === 1 && r.payments[0].method === "cash" && r.cashReceived > 0;
  return (
    <div className={`paper p${r.paperWidth}`}>
      <div className="c"><b>{r.shop}</b>{r.address && <><br />{r.address}</>}{r.whatsapp && <><br />WA {r.whatsapp}</>}</div>
      <hr />
      <Row a="No" b={pad(r.number)} />
      <Row a="Tanggal" b={`${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)}`} />
      {r.customerName && <Row a="Nama" b={r.customerName} />}
      <Row a="Tipe" b={r.orderType + (r.tableNo ? ` / ${r.tableNo}` : "")} />
      <hr />
      {r.items.map((i, k) => (
        <div key={k}>
          <Row a={`${i.qty}x ${i.name}`} b={n(i.base)} />
          {i.options.length > 0 && <div className="ind">{i.options.map((o) => o.name + (o.price ? ` +${n(o.price)}` : "")).join(", ")}</div>}
          {i.note && <div className="ind">&quot;{i.note}&quot;</div>}
          {i.discount > 0 && <Row a={<span className="ind">Diskon</span>} b={`-${n(i.discount)}`} />}
        </div>
      ))}
      <hr />
      <Row a="Subtotal" b={n(r.subtotal)} />
      {r.orderDiscount > 0 && <Row a="Diskon pesanan" b={`-${n(r.orderDiscount)}`} />}
      <Row a="TOTAL" b={n(r.total)} cls="tot" />
      <hr />
      {r.status === "paid" ? (
        <>
          {r.payments.map((p, k) => <Row key={k} a={p.method === "qris" ? "QRIS" : "Tunai"} b={n(single ? r.cashReceived : p.amount)} />)}
          {r.change > 0 && <Row a="Kembalian" b={n(r.change)} />}
        </>
      ) : <div className="c tot">BELUM LUNAS</div>}
      {r.footer && <><hr /><div className="c">{r.footer}</div></>}
    </div>
  );
}
