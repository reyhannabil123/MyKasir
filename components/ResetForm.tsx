"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword, type FormState } from "@/app/actions/auth";
import { Submit } from "./Submit";

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(resetPassword, {});
  return (
    <div className="authbox">
      <div className="brand"><span className="logo">M</span>MyKasir</div>
      <div>
        <h1>Lupa kata sandi</h1>
        <p className="sub" style={{ marginTop: 6 }}>Masukkan kode reset yang kamu simpan di pengaturan Vercel (variabel RESET_CODE).</p>
      </div>
      <form className="card form" action={action}>
        <label className="f"><span>Email akun</span><input className="in" name="email" type="email" autoComplete="email" required /></label>
        <label className="f"><span>Kode reset</span><input className="in" name="code" type="password" autoComplete="off" required /></label>
        <label className="f"><span>Kata sandi baru</span><input className="in" name="next" type="password" minLength={6} autoComplete="new-password" required /></label>
        {state.error && <p className="err" role="alert">{state.error}</p>}
        {state.ok && <p className="okmsg" role="status">{state.ok}</p>}
        <Submit className="btn block">Ganti kata sandi</Submit>
      </form>
      <p className="small center"><Link className="btn sm ghost" href="/login">Kembali ke masuk</Link></p>
    </div>
  );
}
