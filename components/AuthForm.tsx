"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, signup, type FormState } from "@/app/actions/auth";
import { Submit } from "./Submit";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const su = mode === "signup";
  const [state, action] = useActionState<FormState, FormData>(su ? signup : login, {});
  return (
    <div className="authbox">
      <div className="brand"><span className="logo">M</span>MyKasir</div>
      <div>
        <h1>{su ? "Buat akun usaha" : "Masuk ke kasir"}</h1>
        <p className="sub" style={{ marginTop: 6 }}>Kasir sederhana untuk warung, kafe, dan UMKM.</p>
      </div>
      <form className="card form" action={action}>
        {su && (
          <label className="f"><span>Nama usaha</span>
            <input className="in" name="shop" placeholder="Contoh: Kopi Sudut Senja" autoComplete="organization" required />
          </label>
        )}
        <label className="f"><span>Email</span>
          <input className="in" name="email" type="email" placeholder="nama@email.com" autoComplete="email" required />
        </label>
        <label className="f"><span>Kata sandi</span>
          <input className="in" name="password" type="password" placeholder="Minimal 6 karakter" minLength={6}
            autoComplete={su ? "new-password" : "current-password"} required />
        </label>
        {state.error && <p className="err" role="alert">{state.error}</p>}
        <Submit className="btn block">{su ? "Daftar" : "Masuk"}</Submit>
      </form>
      <p className="small center">
        {su ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
        <Link className="btn sm ghost" href={su ? "/login" : "/daftar"}>{su ? "Masuk" : "Daftar"}</Link>
      </p>
    </div>
  );
}
