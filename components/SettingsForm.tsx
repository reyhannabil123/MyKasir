"use client";

import { useActionState, useTransition } from "react";
import { updateProfile, setTheme, type SettingsState } from "@/app/actions/settings";
import { logout } from "@/app/actions/auth";
import { Submit } from "./Submit";

type U = { shopName: string; address: string; whatsapp: string; receiptFooter: string; paperWidth: number; theme: string };

export function SettingsForm({ user }: { user: U }) {
  const [state, action] = useActionState<SettingsState, FormData>(updateProfile, {});
  const [pending, start] = useTransition();
  return (
    <>
      <form action={action} className="stack-lg">
        <section className="card form">
          <h3>Profil usaha</h3>
          <label className="f"><span>Nama usaha</span><input className="in" name="shop" defaultValue={user.shopName} required /></label>
          <label className="f"><span>Alamat</span><input className="in" name="address" defaultValue={user.address} /></label>
          <label className="f"><span>Nomor WhatsApp</span><input className="in" name="whatsapp" defaultValue={user.whatsapp} inputMode="tel" /></label>
        </section>
        <section className="card form">
          <h3>Struk</h3>
          <label className="f"><span>Lebar kertas printer</span>
            <select className="in" name="paper" defaultValue={String(user.paperWidth)}>
              <option value="58">58 mm</option><option value="80">80 mm</option>
            </select>
          </label>
          <label className="f"><span>Pesan penutup</span><input className="in" name="footer" defaultValue={user.receiptFooter} /></label>
        </section>
        {state.error && <p className="err" role="alert">{state.error}</p>}
        {state.ok && <p className="okmsg" role="status">Perubahan tersimpan.</p>}
        <Submit>Simpan perubahan</Submit>
      </form>
      <section className="card form">
        <h3>Tampilan</h3>
        <div className="seg full">
          {([["auto", "Otomatis"], ["light", "Terang"], ["dark", "Gelap"]] as const).map(([k, l]) => (
            <button key={k} type="button" className={user.theme === k ? "on" : ""} disabled={pending}
              onClick={() => start(() => setTheme(k))}>{l}</button>
          ))}
        </div>
      </section>
      <section className="card form">
        <h3>Akun</h3>
        <form action={logout}><button className="btn ghost" type="submit">Keluar</button></form>
      </section>
    </>
  );
}
