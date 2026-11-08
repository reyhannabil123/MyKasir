import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { ReportDTO } from "./reports";
import { fmtDate, fmtTime, pad } from "./format";
import { rupiah } from "./time";

const rangeText = (r: ReportDTO) => {
  const a = fmtDate(r.from), b = fmtDate(new Date(new Date(r.to).getTime() - 1).toISOString());
  return a === b ? a : `${a} – ${b}`;
};
const when = (iso: string) => `${fmtDate(iso)} ${fmtTime(iso)}`;

export async function buildXlsx(r: ReportDTO, shop: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MyKasir";
  const money = '"Rp"#,##0';
  const head = (ws: ExcelJS.Worksheet) => { ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6EEE7" } }; };

  const s = wb.addWorksheet("Ringkasan");
  s.columns = [{ width: 30 }, { width: 22 }];
  s.addRows([[shop], [`Laporan ${rangeText(r)}`], [],
    ["Omzet", r.omzet], ["Pesanan lunas", r.count], ["Total diskon", r.discount], ["Pembayaran tunai", r.cash], ["Pembayaran QRIS", r.qris],
    ["Pengeluaran", r.expenses], ["Estimasi untung", r.profit], ["Belum dibayar (saat ini)", r.unpaid.total], ["Jumlah belum dibayar", r.unpaid.count]]);
  s.getRow(1).font = { bold: true, size: 14 };
  [4, 6, 7, 8, 9, 10, 11].forEach((i) => (s.getRow(i).getCell(2).numFmt = money));

  const t = wb.addWorksheet("Transaksi");
  t.columns = [{ header: "No", width: 8 }, { header: "Dibayar", width: 18 }, { header: "Nama", width: 22 }, { header: "Tipe", width: 18 },
    { header: "Subtotal", width: 14, style: { numFmt: money } }, { header: "Diskon", width: 14, style: { numFmt: money } },
    { header: "Total", width: 14, style: { numFmt: money } }, { header: "Metode", width: 16 }];
  r.orders.forEach((o) => t.addRow([o.number, when(o.paidAt), o.customerName || "-", o.orderType, o.subtotal, o.discount, o.total, o.methods]));
  head(t);

  const m = wb.addWorksheet("Menu terlaris");
  m.columns = [{ header: "Menu", width: 30 }, { header: "Terjual", width: 10 }, { header: "Penjualan", width: 16, style: { numFmt: money } }];
  r.top.forEach((x) => m.addRow([x.name, x.qty, x.revenue]));
  head(m);

  const d = wb.addWorksheet("Per hari");
  d.columns = [{ header: "Tanggal", width: 14 }, { header: "Pesanan", width: 10 }, { header: "Omzet", width: 16, style: { numFmt: money } }];
  r.daily.forEach((x) => d.addRow([x.date, x.count, x.total]));
  head(d);

  const e = wb.addWorksheet("Pengeluaran");
  e.columns = [{ header: "Waktu", width: 18 }, { header: "Keterangan", width: 34 }, { header: "Nominal", width: 16, style: { numFmt: money } }];
  r.expenseList.forEach((x) => e.addRow([when(x.createdAt), x.name, x.amount]));
  head(e);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildPdf(r: ReportDTO, shop: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Laporan ${shop}`, Author: "MyKasir" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const L = 40, W = 515;

  const ensure = (h: number) => { if (doc.y + h > 790) doc.addPage(); };
  const h2 = (t: string) => { ensure(60); doc.moveDown(0.8).font("Helvetica-Bold").fontSize(12).fillColor("#15231F").text(t, L).moveDown(0.3); };
  const row = (cells: string[], xs: number[], aligns: ("left" | "right")[], bold = false) => {
    ensure(18);
    const y = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor("#15231F");
    cells.forEach((c, i) => {
      const w = (xs[i + 1] ?? L + W) - xs[i] - 6;
      doc.text(c, xs[i], y, { width: w, align: aligns[i], lineBreak: false, ellipsis: true });
    });
    doc.y = y + 16;
    doc.moveTo(L, doc.y - 3).lineTo(L + W, doc.y - 3).strokeColor("#E1E7E4").lineWidth(0.5).stroke();
  };

  doc.font("Helvetica-Bold").fontSize(18).fillColor("#0C7A64").text(shop, L);
  doc.font("Helvetica").fontSize(11).fillColor("#5A6B64").text(`Laporan penjualan · ${rangeText(r)}`, L);

  h2("Ringkasan");
  const sum: [string, string][] = [["Omzet", rupiah(r.omzet)], ["Pesanan lunas", String(r.count)], ["Total diskon", rupiah(r.discount)],
    ["Tunai", rupiah(r.cash)], ["QRIS", rupiah(r.qris)], ["Pengeluaran", rupiah(r.expenses)], ["Estimasi untung", rupiah(r.profit)],
    [`Belum dibayar (${r.unpaid.count} pesanan, saat ini)`, rupiah(r.unpaid.total)]];
  sum.forEach(([a, b], i) => row([a, b], [L, L + 300], ["left", "right"], i === 0 || i === 6));

  if (r.top.length) {
    h2("Menu terlaris");
    const xs = [L, L + 330, L + 400];
    row(["Menu", "Terjual", "Penjualan"], xs, ["left", "right", "right"], true);
    r.top.forEach((x) => row([x.name, String(x.qty), rupiah(x.revenue)], xs, ["left", "right", "right"]));
  }
  if (r.daily.length > 1) {
    h2("Per hari");
    const xs = [L, L + 200, L + 330];
    row(["Tanggal", "Pesanan", "Omzet"], xs, ["left", "right", "right"], true);
    r.daily.forEach((x) => row([x.date, String(x.count), rupiah(x.total)], xs, ["left", "right", "right"]));
  }
  if (r.expenseList.length) {
    h2("Pengeluaran");
    const xs = [L, L + 90, L + 400];
    row(["Waktu", "Keterangan", "Nominal"], xs, ["left", "left", "right"], true);
    r.expenseList.forEach((x) => row([when(x.createdAt), x.name, rupiah(x.amount)], xs, ["left", "left", "right"]));
  }
  if (r.orders.length) {
    h2("Daftar transaksi");
    const xs = [L, L + 34, L + 104, L + 210, L + 300, L + 360, L + 425];
    const al: ("left" | "right")[] = ["left", "left", "left", "left", "right", "right", "left"];
    row(["No", "Dibayar", "Nama", "Tipe", "Diskon", "Total", "Metode"], xs, al, true);
    r.orders.forEach((o) => row([pad(o.number), when(o.paidAt), o.customerName || "-", o.orderType, o.discount ? rupiah(o.discount) : "-", rupiah(o.total), o.methods], xs, al));
  }
  doc.end();
  return done;
}
