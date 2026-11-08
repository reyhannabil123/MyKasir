"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, categories, passwordResets } from "@/lib/schema";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
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
  const next = String(fd.get("next") ?? "");
  const again = String(fd.get("again") ?? "");
  if (next.length < 6) return { error: "Kata sandi baru minimal 6 karakter." };
  if (next !== again) return { error: "Konfirmasi kata sandi baru tidak sama." };
  await db().update(users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(users.id, u.id));
  return { ok: "Kata sandi berhasil diganti." };
}

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const SENT: FormState = { ok: "Jika email terdaftar, link reset sudah dikirim. Cek kotak masuk (dan folder spam). Link berlaku 30 menit." };

/** Minta link reset lewat email. Balasan selalu sama supaya email terdaftar tidak bisa ditebak orang lain. */
export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { error: "Reset lewat email belum diaktifkan (RESEND_API_KEY belum diisi di Vercel)." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "Format email belum benar." };

  const [u] = await db().select({ id: users.id, shop: users.shopName }).from(users).where(eq(users.email, email)).limit(1);
  if (!u) return SENT;
  const [recent] = await db().select({ id: passwordResets.id }).from(passwordResets)
    .where(and(eq(passwordResets.userId, u.id), gt(passwordResets.createdAt, new Date(Date.now() - 60_000)))).limit(1);
  if (recent) return { error: "Tunggu 1 menit sebelum meminta link lagi." };

  const token = randomBytes(32).toString("base64url");
  await db().delete(passwordResets).where(eq(passwordResets.userId, u.id));
  await db().insert(passwordResets).values({ userId: u.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 30 * 60_000) });

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  const link = `${base}/reset/${token}`;
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESET_FROM || "MyKasir <onboarding@resend.dev>",
        to: [email],
        subject: "Atur ulang kata sandi MyKasir",
        html: `<p>Halo, ada permintaan atur ulang kata sandi untuk <b>${u.shop.replace(/[<>&]/g, "")}</b>.</p><p><a href="${link}">Klik di sini untuk membuat kata sandi baru</a> (berlaku 30 menit).</p><p>Jika bukan kamu yang meminta, abaikan email ini.</p>`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { error: "Email gagal terkirim. Coba lagi sebentar." };
  }
  if (!res.ok) return { error: "Email gagal terkirim. Periksa pengaturan Resend (domain dan pengirim)." };
  return SENT;
}

export async function resetWithToken(token: string, _: FormState, fd: FormData): Promise<FormState> {
  const next = String(fd.get("next") ?? "");
  const again = String(fd.get("again") ?? "");
  if (next.length < 6) return { error: "Kata sandi baru minimal 6 karakter." };
  if (next !== again) return { error: "Konfirmasi kata sandi tidak sama." };
  // Tandai terpakai lebih dulu (atomik) supaya link tidak bisa dipakai dua kali.
  const [t] = await db().update(passwordResets).set({ usedAt: new Date() })
    .where(and(eq(passwordResets.tokenHash, sha(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .returning({ userId: passwordResets.userId });
  if (!t) return { error: "Link tidak valid atau sudah kedaluwarsa. Minta link baru." };
  await db().update(users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(users.id, t.userId));
  return { ok: "Kata sandi diganti. Silakan masuk dengan kata sandi baru." };
}
