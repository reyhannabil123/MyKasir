import { rupiah } from "./time";
import { fmtWhen, pad } from "./format";
import type { ReceiptDTO } from "./types";

/** Teks struk untuk disalin atau dibagikan lewat WhatsApp. */
export function receiptText(r: ReceiptDTO): string {
  const L: string[] = [`*${r.shop}*`];
  if (r.address) L.push(r.address);
  L.push(`Struk #${pad(r.number)} · ${fmtWhen(r.createdAt)}`);
  if (r.customerName) L.push(`Atas nama: ${r.customerName}`);
  L.push("");
  for (const i of r.items) {
    L.push(`${i.qty}x ${i.name} ${rupiah(i.base)}`);
    if (i.options.length) L.push(`   ${i.options.map((o) => o.name).join(", ")}`);
    if (i.note) L.push(`   "${i.note}"`);
    if (i.discount) L.push(`   Diskon -${rupiah(i.discount)}`);
  }
  L.push("");
  if (r.orderDiscount) L.push(`Diskon pesanan -${rupiah(r.orderDiscount)}`);
  L.push(`*Total ${rupiah(r.total)}*`);
  L.push(r.status === "paid" ? `Dibayar: ${r.payments.map((p) => `${p.method === "qris" ? "QRIS" : "Tunai"} ${rupiah(p.amount)}`).join(" + ")}` : "Status: BELUM LUNAS");
  if (r.footer) L.push("", r.footer);
  return L.join("\n");
}
