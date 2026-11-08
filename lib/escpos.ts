import { fmtDate, fmtTime, pad } from "./format";
import type { ReceiptDTO } from "./types";

const n = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** Printer thermal umumnya hanya mengerti ASCII: buang aksen dan karakter khusus. */
const ascii = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "?");

/** Jumlah karakter per baris: 32 untuk kertas 58 mm, 48 untuk 80 mm. */
export const colsFor = (paperWidth: number) => (paperWidth >= 80 ? 48 : 32);

function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of s.split(" ")) {
    let wd = word;
    while (wd.length > w) { if (line) { out.push(line); line = ""; } out.push(wd.slice(0, w)); wd = wd.slice(w); }
    if (!line) line = wd;
    else if ((line + " " + wd).length <= w) line += " " + wd;
    else { out.push(line); line = wd; }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

/** Baris kiri-kanan; teks kiri dilipat bila terlalu panjang. */
function row(a: string, b: string, w: number): string[] {
  a = ascii(a); b = ascii(b);
  const lead = a.match(/^ */)![0];
  const room = Math.max(1, w - b.length - 1 - lead.length);
  const parts = wrap(a.trimStart(), room).map((l) => lead + l);
  const last = parts.pop()!;
  return [...parts, last + " ".repeat(Math.max(1, w - last.length - b.length)) + b];
}

type Seg = { text: string; align?: "l" | "c"; bold?: boolean };

/** Isi struk sebagai potongan teks; dipisahkan dari pengkodean ESC/POS supaya mudah dites. */
export function receiptSegments(r: ReceiptDTO, w: number): Seg[] {
  const S: Seg[] = [];
  const add = (t: string, o: Partial<Seg> = {}) => S.push({ text: t, ...o });
  const hr = () => add("-".repeat(w));
  const center = (t: string, bold = false) => wrap(ascii(t), w).forEach((l) => add(l, { align: "c", bold }));
  const rows = (a: string, b: string, bold = false) => row(a, b, w).forEach((l) => add(l, { bold }));

  center(r.shop, true);
  if (r.address) center(r.address);
  if (r.whatsapp) center(`WA ${r.whatsapp}`);
  hr();
  rows("No", pad(r.number));
  rows("Tanggal", `${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)}`);
  if (r.customerName) rows("Nama", r.customerName);
  rows("Tipe", r.orderType + (r.tableNo ? ` / ${r.tableNo}` : ""));
  hr();
  for (const i of r.items) {
    rows(`${i.qty}x ${i.name}`, n(i.base));
    if (i.options.length) wrap(ascii(i.options.map((o) => o.name + (o.price ? ` +${n(o.price)}` : "")).join(", ")), w - 2).forEach((l) => add("  " + l));
    if (i.note) wrap(`"${ascii(i.note)}"`, w - 2).forEach((l) => add("  " + l));
    if (i.discount > 0) rows("  Diskon", `-${n(i.discount)}`);
  }
  hr();
  rows("Subtotal", n(r.subtotal));
  if (r.orderDiscount > 0) rows("Diskon pesanan", `-${n(r.orderDiscount)}`);
  rows("TOTAL", n(r.total), true);
  hr();
  if (r.status === "paid") {
    const single = r.payments.length === 1 && r.payments[0].method === "cash" && r.cashReceived > 0;
    r.payments.forEach((p) => rows(p.method === "qris" ? "QRIS" : "Tunai", n(single ? r.cashReceived : p.amount)));
    if (r.change > 0) rows("Kembalian", n(r.change));
  } else center("BELUM LUNAS", true);
  if (r.footer) { hr(); center(r.footer); }
  return S;
}

/** Perintah ESC/POS: inisialisasi, rata tengah/kiri, tebal, lalu dorong kertas agar struk bisa disobek. */
export function escposReceipt(r: ReceiptDTO): Uint8Array {
  const out: number[] = [0x1b, 0x40]; // ESC @ : reset printer
  let align = -1, bold = false;
  for (const s of receiptSegments(r, colsFor(r.paperWidth))) {
    const a = s.align === "c" ? 1 : 0;
    if (a !== align) { out.push(0x1b, 0x61, a); align = a; } // ESC a n
    if (!!s.bold !== bold) { out.push(0x1b, 0x45, s.bold ? 1 : 0); bold = !!s.bold; } // ESC E n
    for (const ch of s.text) out.push(ch.charCodeAt(0) & 0x7f);
    out.push(0x0a);
  }
  out.push(0x1b, 0x45, 0, 0x1b, 0x61, 0, 0x1b, 0x64, 4); // ESC d 4 : feed 4 baris
  return Uint8Array.from(out);
}

export const toBase64 = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
