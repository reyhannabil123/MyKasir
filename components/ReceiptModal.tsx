"use client";

import { useEffect, useState } from "react";

/** Lebar area cetak efektif printer thermal (mm). Sisanya jadi margin kiri-kanan. */
const PRINTABLE: Record<number, number> = { 58: 48, 80: 72 };
import { getReceipt } from "@/app/actions/orders";
import { receiptText } from "@/lib/receipt-text";
import { pad } from "@/lib/format";
import { rupiah } from "@/lib/time";
import type { ReceiptDTO } from "@/lib/types";
import { Modal } from "./Modal";
import { Receipt } from "./Receipt";
import { Icon } from "./Icon";
import { escposReceipt, toBase64 } from "@/lib/escpos";
import { btSupported, printBluetooth } from "@/lib/bt-print";

export function ReceiptModal({ orderId, title, onClose }: { orderId: string; title?: string; onClose: () => void }) {
  const [r, setR] = useState<ReceiptDTO | null | undefined>(undefined);
  const [copied, setCopied] = useState("");
  const [btMsg, setBtMsg] = useState("");
  const [btBusy, setBtBusy] = useState(false);
  const [pageH, setPageH] = useState(0); // tinggi kertas (mm), diukur sebelum mencetak
  useEffect(() => {
    let alive = true;
    getReceipt(orderId).then((x) => alive && setR(x)).catch(() => alive && setR(null));
    return () => { alive = false; };
  }, [orderId]);

  async function copy() {
    if (!r) return;
    try { await navigator.clipboard.writeText(receiptText(r)); setCopied("Teks struk disalin."); }
    catch { setCopied("Tidak bisa menyalin otomatis. Gunakan tombol WhatsApp."); }
    setTimeout(() => setCopied(""), 2500);
  }

  /** Chrome tidak mengenali "size: 58mm auto", jadi tinggi struk diukur dulu lalu dipasang sebagai ukuran halaman. */
  function printNow() {
    if (!r) return;
    const src = document.querySelector(".print-area .paper");
    const w = PRINTABLE[r.paperWidth] ?? 48;
    if (src) {
      const box = document.createElement("div");
      box.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}mm;font-size:11px`;
      const c = src.cloneNode(true) as HTMLElement;
      c.style.cssText = "max-width:none;width:100%;padding:0;box-shadow:none;border-radius:0;font-size:11px";
      box.appendChild(c);
      document.body.appendChild(box);
      const mm = Math.ceil((box.scrollHeight * 25.4) / 96) + 10;
      box.remove();
      setPageH(Math.max(40, mm));
    }
    setTimeout(() => window.print(), 120);
  }

  async function printBt() {
    if (!r) return;
    setBtBusy(true); setBtMsg("");
    try { await printBluetooth(escposReceipt(r)); setBtMsg("Struk dikirim ke printer."); }
    catch (e) { setBtMsg(e instanceof Error ? e.message : "Gagal mencetak."); }
    setBtBusy(false);
  }
  const rawbtHref = r ? `intent:base64,${toBase64(escposReceipt(r))}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;` : "#";

  const side = r ? Math.max(0, (r.paperWidth - (PRINTABLE[r.paperWidth] ?? 48)) / 2) : 0;
  return (
    <Modal title={title ?? (r ? `Struk #${pad(r.number)}` : "Struk")} onClose={onClose}>
      {r === undefined && <p className="hint">Memuat struk…</p>}
      {r === null && <p className="err">Struk tidak ditemukan.</p>}
      {r && (
        <>
          <style>{`@page{size:${r.paperWidth}mm ${pageH || 200}mm;margin:2mm ${side}mm}`}</style>
          <p className="sub small" style={{ marginTop: -8 }}>{r.status === "paid" ? `Lunas · ${rupiah(r.total)}` : `Belum lunas · ${rupiah(r.total)}`}</p>
          <div className="print-area"><Receipt r={r} /></div>
          <div className="row">
            <button className="btn grow" onClick={printNow}><Icon n="printer" /> Cetak struk</button>
            <a className="btn ghost grow" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(receiptText(r))}`}>Kirim lewat WhatsApp</a>
          </div>
          <div className="row">
            {btSupported() && <button className="btn grow" disabled={btBusy} onClick={printBt}><Icon n="printer" /> {btBusy ? "Mengirim…" : "Cetak Bluetooth"}</button>}
            <a className="btn outl grow" href={rawbtHref}>Cetak via RawBT</a>
          </div>
          {btMsg && <p className="notice" role="status">{btMsg}</p>}
          <button className="btn outl block" onClick={copy}>Salin teks struk</button>
          {copied && <p className="okmsg" role="status">{copied}</p>}
          <p className="hint"><b>Cetak Bluetooth</b> langsung ke printer (butuh Chrome dan printer Bluetooth jenis BLE). <b>Cetak via RawBT</b> untuk printer Bluetooth biasa lewat aplikasi RawBT. Lebar kertas diatur di Pengaturan ({r.paperWidth} mm).</p>
        </>
      )}
    </Modal>
  );
}
