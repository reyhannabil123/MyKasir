"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

export async function saveQris(dataUrl: string): Promise<ActionResult> {
  const u = await requireUser();
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl) || dataUrl.length > 900_000)
    return { ok: false, error: "Gambar tidak valid atau terlalu besar. Coba gambar lain." };
  await db().update(users).set({ qrisImage: dataUrl }).where(eq(users.id, u.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteQris(): Promise<ActionResult> {
  const u = await requireUser();
  await db().update(users).set({ qrisImage: "" }).where(eq(users.id, u.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
