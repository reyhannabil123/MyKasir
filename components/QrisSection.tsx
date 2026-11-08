"use client";

import { useRef, useState, useTransition } from "react";
import { deleteQris, saveQris } from "@/app/actions/qris";
import { resizeImage } from "@/lib/image";
import { Icon } from "./Icon";

export function QrisSection({ url }: { url: string | null }) {
  const file = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  async function pick(f?: File) {
    if (!f) return;
    setErr("");
    try {
      const data = await resizeImage(f, 800, "image/jpeg", 0.9);
      start(async () => { const r = await saveQris(data); if (!r.ok) setErr(r.error); });
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <section className="card form">
      <h3>QRIS</h3>
      {url ? (
        <div className="qrbox" style={{ justifySelf: "start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="QRIS toko" style={{ maxWidth: 200 }} />
        </div>
      ) : <p className="hint">Belum ada QRIS. Upload gambar QRIS toko supaya pilihan QRIS aktif saat pembayaran.</p>}
      <div className="row">
        <button type="button" className={`btn ${url ? "ghost" : ""}`} disabled={pending} onClick={() => file.current?.click()}>
          <Icon n="upload" /> {pending ? "Menyimpan…" : url ? "Ganti gambar QRIS" : "Upload QRIS"}
        </button>
        {url && <button type="button" className="btn danger" disabled={pending} onClick={() => start(async () => { await deleteQris(); })}>Hapus</button>}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  );
}
