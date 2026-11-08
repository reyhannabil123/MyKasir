"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { rupiah } from "@/lib/time";
import type { PaymentInput } from "@/lib/types";
import { Modal } from "./Modal";
import { MoneyInput } from "./MoneyInput";

type Tab = "qris" | "cash" | "later";

function Qr({ url }: { url: string }) {
  return (
    <div className="qrbox">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Kode QRIS toko" />
      <p className="qrnote">Cek manual dulu di aplikasi atau mutasi rekening bahwa pembayaran sudah masuk sebelum menekan OK.</p>
    </div>
  );
}

export function PayModal({ total, qrisUrl, customerName, onClose, onSubmit, title = "Pembayaran", allowLater = true }: {
  total: number; qrisUrl: string | null; customerName: string; onClose: () => void; title?: string; allowLater?: boolean;
  onSubmit: (p: PaymentInput, name: string) => Promise<string | null>;
}) {
  const [tab, setTab] = useState<Tab>("cash");
  const [cash, setCash] = useState(0);
  const [split, setSplit] = useState(false);
  const [name, setName] = useState(customerName);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const go = (p: PaymentInput) => start(async () => { setErr((await onSubmit(p, name)) ?? ""); });
  const quick = [20000, 50000, 100000].filter((x) => x >= total).slice(0, 3);
  const cashOk = split ? cash > 0 && cash < total && !!qrisUrl : cash >= total;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="total-big num" style={{ marginTop: -6 }}>{rupiah(total)}</div>
      <div className="tabs" role="tablist">
        {([["qris", "QRIS"], ["cash", "Tunai"], ...(allowLater ? [["later", "Bayar nanti"] as const] : [])] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setErr(""); }}>{l}</button>
        ))}
      </div>

      {tab === "qris" && (qrisUrl ? (
        <div className="stack">
          <Qr url={qrisUrl} />
          <button className="btn block" disabled={pending} onClick={() => go({ kind: "qris" })}>{pending ? "Menyimpan…" : "OK, pembayaran diterima"}</button>
        </div>
      ) : (
        <div className="notice"><b>QRIS belum diupload</b>
          <span>Upload gambar QRIS toko di Pengaturan supaya bisa dipakai untuk pembayaran.</span>
          <Link className="btn sm" href="/pengaturan">Upload QRIS</Link></div>
      ))}

      {tab === "cash" && (
        <div className="stack">
          <div className="quick">
            <button className="btn sm" onClick={() => { setCash(total); setSplit(false); }}>Uang pas</button>
            {quick.map((x) => <button key={x} className="btn sm ghost" onClick={() => setCash(x)}>{String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</button>)}
          </div>
          <label className="f"><span>{split ? "Dibayar tunai" : "Uang diterima"}</span><MoneyInput value={cash} onChange={setCash} /></label>
          <label className={`opt ${qrisUrl ? "" : "dim"}`}>
            <span>Pisah pembayaran: sisanya lewat QRIS</span>
            <input type="checkbox" checked={split} disabled={!qrisUrl} onChange={(e) => setSplit(e.target.checked)} />
          </label>
          {split ? (
            cashOk ? (<><div className="kv"><span className="muted">Sisa lewat QRIS</span><b className="num">{rupiah(total - cash)}</b></div>{qrisUrl && <Qr url={qrisUrl} />}</>)
              : <p className="hint">Isi nominal tunai yang lebih kecil dari total. Sisanya dibayar lewat QRIS.</p>
          ) : cash > 0 ? (
            cashOk ? <div className="change"><span className="small muted">Kembalian</span><b className="num">{rupiah(cash - total)}</b></div>
              : <div className="change short"><span className="small muted">Masih kurang</span><b className="num">{rupiah(total - cash)}</b></div>
          ) : <p className="hint">Isi uang yang diterima, atau ketuk Uang pas.</p>}
          <button className="btn block" disabled={!cashOk || pending}
            onClick={() => go(split ? { kind: "split", cash } : { kind: "cash", received: cash })}>
            {pending ? "Menyimpan…" : split ? "OK, terima tunai + QRIS" : "Selesaikan pembayaran"}
          </button>
        </div>
      )}

      {tab === "later" && (
        <div className="stack">
          <label className="f"><span>Atas nama <small>(opsional)</small></span>
            <input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Bu Rina" maxLength={60} /></label>
          <p className="hint">Pesanan disimpan di daftar Bayar nanti. Pembayaran bisa dicatat kapan saja lewat tombol Tandai lunas.</p>
          <button className="btn block" disabled={pending} onClick={() => go({ kind: "later" })}>{pending ? "Menyimpan…" : "Simpan sebagai bayar nanti"}</button>
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </Modal>
  );
}
