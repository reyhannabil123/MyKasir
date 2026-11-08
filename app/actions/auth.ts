"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, categories } from "@/lib/schema";
import { timingSafeEqual } from "node:crypto";
import { createSession, destroySession, requireUser } from "@/lib/auth";

export type FormState = { error?: string; ok?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const shop = String(fd.get("shop") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");

  if (!shop) return { error: "Nama usaha wajib diisi." };
  if (!EMAIL.test(email)) return { error: "Format email belum benar." };
  if (password.length < 6) return { error: "Kata sandi minimal 6 karakter." };

  const [exists] = await db().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (exists) return { error: "Email ini sudah terdaftar. Silakan masuk." };

  const passwordHash = await bcrypt.hash(password, 10);
  const [u] = await db().insert(users).values({ email, passwordHash, shopName: shop }).returning({ id: users.id });
  // Kategori awal supaya menu pertama langsung bisa dikelompokkan.
  await db().insert(categories).values([
    { userId: u.id, name: "Makanan", sort: 0 },
    { userId: u.id, name: "Minuman", sort: 1 },
  ]);
  await createSession(u.id);
  redirect("/");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Isi email dan kata sandi." };

  const [u] = await db().select().from(users).where(eq(users.email, email)).limit(1);
  const ok = u ? await bcrypt.compare(password, u.passwordHash) : false;
  if (!u || !ok) return { error: "Email atau kata sandi salah." };

  await createSession(u.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const again = String(fd.get("again") ?? "");
  if (next.length < 6) return { error: "Kata sandi baru minimal 6 karakter." };
  if (next !== again) return { error: "Konfirmasi kata sandi baru tidak sama." };
  const [row] = await db().select({ h: users.passwordHash }).from(users).where(eq(users.id, u.id)).limit(1);
  if (!row || !(await bcrypt.compare(current, row.h))) return { error: "Kata sandi lama salah." };
  await db().update(users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(users.id, u.id));
  return { ok: "Kata sandi berhasil diganti." };
}

/** Reset darurat saat lupa kata sandi. Aktif hanya jika RESET_CODE (min. 12 karakter) diisi di Vercel. */
export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const secret = process.env.RESET_CODE ?? "";
  if (secret.length < 12) return { error: "Reset kata sandi belum diaktifkan. Isi RESET_CODE di pengaturan Vercel." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const code = String(fd.get("code") ?? "");
  const next = String(fd.get("next") ?? "");
  const a = Buffer.from(code), b = Buffer.from(secret);
  const okCode = a.length === b.length && timingSafeEqual(a, b);
  if (!okCode) {
    await new Promise((r) => setTimeout(r, 1500)); // memperlambat tebak-tebakan
    return { error: "Kode reset salah." };
  }
  if (next.length < 6) return { error: "Kata sandi baru minimal 6 karakter." };
  const r = await db().update(users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(users.email, email)).returning({ id: users.id });
  if (!r.length) return { error: "Email tidak ditemukan." };
  return { ok: "Kata sandi diganti. Silakan masuk dengan kata sandi baru." };
}
