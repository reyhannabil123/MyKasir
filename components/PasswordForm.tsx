"use client";

import { useActionState } from "react";
import { changePassword, type FormState } from "@/app/actions/auth";
import { Submit } from "./Submit";

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePassword, {});
  return (
    <form action={action} className="card form" key={state.ok ? "done" : "form"}>
      <h3>Ganti kata sandi</h3>
      <label className="f"><span>Kata sandi baru</span><input className="in" name="next" type="password" minLength={6} autoComplete="new-password" required /></label>
      <label className="f"><span>Ulangi kata sandi baru</span><input className="in" name="again" type="password" minLength={6} autoComplete="new-password" required /></label>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.ok && <p className="okmsg" role="status">{state.ok}</p>}
      <Submit className="btn">Simpan kata sandi</Submit>
    </form>
  );
}
