"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestReset, resetWithToken, type FormState } from "@/app/actions/auth";
import { Submit } from "./Submit";

/** Tanpa token: minta link lewat email. Dengan token: isi kata sandi baru. */
export function ResetForm({ token }: { token?: string }) {
  const [state, action] = useActionState<FormState, FormData>(token ? resetWithToken.bind(null, token) : requestReset, {});
  return (
    <div className="authbox">
      <div className="brand"><span className="logo">M</span>MyKasir</div>
      <div>
        <h1>{token ? "Buat kata sandi baru" : "Lupa kata sandi"}</h1>
        {!token && <p className="sub" style={{ marginTop: 6 }}>Masukkan email akunmu. Kami kirim link untuk membuat kata sandi baru.</p>}
      </div>
      <form className="card form" action={action}>
        {token ? (
          <>
            <label className="f"><span>Kata sandi baru</span><input className="in" name="next" type="password" minLength={6} autoComplete="new-password" required /></label>
            <label className="f"><span>Ulangi kata sandi baru</span><input className="in" name="again" type="password" minLength={6} autoComplete="new-password" required /></label>
          </>
        ) : (
          <label className="f"><span>Email akun</span><input className="in" name="email" type="email" autoComplete="email" required /></label>
        )}
        {state.error && <p className="err" role="alert">{state.error}</p>}
        {state.ok && <p className="okmsg" role="status">{state.ok}</p>}
        {!state.ok && <Submit className="btn block">{token ? "Simpan kata sandi" : "Kirim link reset"}</Submit>}
      </form>
      <p className="small center"><Link className="btn sm ghost" href="/login">{state.ok && token ? "Masuk" : "Kembali ke masuk"}</Link></p>
    </div>
  );
}
