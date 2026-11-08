"use client";

import { useEffect, useState } from "react";
import { getReceipt } from "@/app/actions/orders";
import { receiptText } from "@/lib/receipt-text";
import { pad } from "@/lib/format";
import { rupiah } from "@/lib/time";
import type { ReceiptDTO } from "@/lib/types";
import { Modal } from "./Modal";
import { Receipt } from "./Receipt";
import { Icon } from "./Icon";

export function ReceiptModal({ orderId, title, onClose }: { orderId: string; title?: string; onClose: () => void }) {
  const [r, setR] = useState<ReceiptDTO | null | undefined>(undefined);
  const [copied, setCopied] = useState("");
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

  return (
    <Modal title={title ?? (r ? `Struk #${pad(r.number)}` : "Struk")} onClose={onClose}>
      {r === undefined && <p className="hint">Memuat struk…</p>}
      {r === null && <p className="err">Struk tidak ditemukan.</p>}
      {r && (
        <>
          <style>{`@page{size:${r.paperWidth}mm auto;margin:2mm}`}</style>
          <p className="sub small" style={{ marginTop: -8 }}>{r.status === "paid" ? `Lunas · ${rupiah(r.total)}` : `Belum lunas · ${rupiah(r.total)}`}</p>
          <div className="print-area"><Receipt r={r} /></div>
          <div className="row">
            <button className="btn grow" onClick={() => window.print()}><Icon n="printer" /> Cetak struk</button>
            <a className="btn ghost grow" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(receiptText(r))}`}>Kirim lewat WhatsApp</a>
          </div>
          <button className="btn outl block" onClick={copy}>Salin teks struk</button>
          {copied && <p className="okmsg" role="status">{copied}</p>}
          <p className="hint">Untuk printer thermal Bluetooth, pilih printernya di jendela cetak. Lebar kertas diatur di Pengaturan ({r.paperWidth} mm).</p>
        </>
      )}
    </Modal>
  );
}
