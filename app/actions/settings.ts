"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUser } from "@/lib/auth";

export type SettingsState = { ok?: boolean; error?: string };

export async function updateProfile(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const u = await requireUser();
  const shop = String(fd.get("shop") ?? "").trim();
  if (!shop) return { error: "Nama usaha wajib diisi." };
  const paper = Number(fd.get("paper")) === 80 ? 80 : 58;
  await db().update(users).set({
    shopName: shop,
    address: String(fd.get("address") ?? "").trim(),
    whatsapp: String(fd.get("whatsapp") ?? "").trim(),
    receiptFooter: String(fd.get("footer") ?? "").trim(),
    paperWidth: paper,
  }).where(eq(users.id, u.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setTheme(theme: "auto" | "light" | "dark") {
  const u = await requireUser();
  const t = theme === "light" || theme === "dark" ? theme : "auto";
  await db().update(users).set({ theme: t }).where(eq(users.id, u.id));
  (await cookies()).set("mk-theme", t, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
