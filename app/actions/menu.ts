"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, menuItems, menuItemVariantGroups, variantGroups, variantOptions } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import type { ActionResult, MenuItemInput, VariantGroupInput } from "@/lib/types";

const fail = (error: string): ActionResult => ({ ok: false, error });
const done = (): ActionResult => {
  revalidatePath("/", "layout");
  return { ok: true };
};
const MAX_IMAGE = 600_000; // karakter data URL, sekitar 450 KB

function cleanImage(img: string | undefined): string | undefined | null {
  if (img === undefined || img === "") return img;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) && img.length <= MAX_IMAGE ? img : null;
}

/* ---------- menu ---------- */
export async function saveMenuItem(input: MenuItemInput): Promise<ActionResult> {
  const u = await requireUser();
  const name = String(input.name ?? "").trim().slice(0, 80);
  const price = Math.round(Number(input.price));
  if (!name) return fail("Nama menu wajib diisi.");
  if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) return fail("Harga wajib diisi dengan benar.");
  const stock = input.unlimitedStock ? 0 : Math.max(0, Math.round(Number(input.stock) || 0));
  const image = cleanImage(input.image);
  if (image === null) return fail("Foto tidak valid atau terlalu besar. Coba foto lain.");

  let categoryId: string | null = null;
  if (input.categoryId) {
    const [c] = await db().select({ id: categories.id }).from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.userId, u.id))).limit(1);
    if (!c) return fail("Kategori tidak ditemukan.");
    categoryId = c.id;
  }
  const wanted = [...new Set(input.groupIds ?? [])];
  if (wanted.length) {
    const ok = await db().select({ id: variantGroups.id }).from(variantGroups)
      .where(and(eq(variantGroups.userId, u.id), inArray(variantGroups.id, wanted)));
    if (ok.length !== wanted.length) return fail("Ada varian yang tidak ditemukan.");
  }

  const base = { name, price, categoryId, unlimitedStock: input.unlimitedStock, stock, ...(image !== undefined ? { image } : {}) };
  let id = input.id;
  if (id) {
    const r = await db().update(menuItems).set(base).where(and(eq(menuItems.id, id), eq(menuItems.userId, u.id))).returning({ id: menuItems.id });
    if (!r.length) return fail("Menu tidak ditemukan.");
    await db().delete(menuItemVariantGroups).where(eq(menuItemVariantGroups.menuItemId, id));
  } else {
    const [m] = await db().select({ m: max(menuItems.sort) }).from(menuItems).where(eq(menuItems.userId, u.id));
    const [row] = await db().insert(menuItems).values({ ...base, userId: u.id, sort: (m.m ?? -1) + 1 }).returning({ id: menuItems.id });
    id = row.id;
  }
  if (wanted.length) await db().insert(menuItemVariantGroups).values(wanted.map((groupId) => ({ menuItemId: id!, groupId })));
  return done();
}

export async function deleteMenuItem(id: string): Promise<ActionResult> {
  const u = await requireUser();
  await db().delete(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.userId, u.id)));
  return done();
}

export async function moveMenuItem(id: string, dir: -1 | 1): Promise<ActionResult> {
  const u = await requireUser();
  const [me] = await db().select().from(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.userId, u.id))).limit(1);
  if (!me) return fail("Menu tidak ditemukan.");
  const list = await db().select({ id: menuItems.id, sort: menuItems.sort }).from(menuItems)
    .where(and(eq(menuItems.userId, u.id), me.categoryId ? eq(menuItems.categoryId, me.categoryId) : isNull(menuItems.categoryId)))
    .orderBy(asc(menuItems.sort), asc(menuItems.createdAt));
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return done();
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, k) => (x.sort === k ? null : db().update(menuItems).set({ sort: k }).where(eq(menuItems.id, x.id)))));
  return done();
}

export async function toggleFavorite(id: string): Promise<ActionResult> {
  const u = await requireUser();
  const [m] = await db().select({ f: menuItems.favorite }).from(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.userId, u.id))).limit(1);
  if (!m) return fail("Menu tidak ditemukan.");
  await db().update(menuItems).set({ favorite: !m.f }).where(eq(menuItems.id, id));
  return done();
}

export async function toggleSoldOut(id: string): Promise<ActionResult> {
  const u = await requireUser();
  const [m] = await db().select().from(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.userId, u.id))).limit(1);
  if (!m) return fail("Menu tidak ditemukan.");
  if (!m.unlimitedStock && m.stock <= 0 && !m.soldOut) return fail("Stok sudah 0. Ubah jumlah stok lewat tombol Ubah.");
  await db().update(menuItems).set({ soldOut: !m.soldOut }).where(eq(menuItems.id, id));
  return done();
}

/* ---------- varian ---------- */
export async function saveVariantGroup(input: VariantGroupInput): Promise<ActionResult> {
  const u = await requireUser();
  const name = String(input.name ?? "").trim().slice(0, 60);
  if (!name) return fail("Nama kategori varian wajib diisi.");
  const opts = (input.options ?? [])
    .map((o) => ({ name: String(o.name ?? "").trim().slice(0, 60), price: Math.max(0, Math.round(Number(o.price) || 0)) }))
    .filter((o) => o.name);
  if (!opts.length) return fail("Isi minimal satu pilihan.");

  let id = input.id;
  if (id) {
    const r = await db().update(variantGroups).set({ name, required: !!input.required })
      .where(and(eq(variantGroups.id, id), eq(variantGroups.userId, u.id))).returning({ id: variantGroups.id });
    if (!r.length) return fail("Varian tidak ditemukan.");
    await db().delete(variantOptions).where(eq(variantOptions.groupId, id));
  } else {
    const [m] = await db().select({ m: max(variantGroups.sort) }).from(variantGroups).where(eq(variantGroups.userId, u.id));
    const [row] = await db().insert(variantGroups).values({ userId: u.id, name, required: !!input.required, sort: (m.m ?? -1) + 1 }).returning({ id: variantGroups.id });
    id = row.id;
  }
  await db().insert(variantOptions).values(opts.map((o, sort) => ({ groupId: id!, name: o.name, price: o.price, sort })));
  return done();
}

export async function deleteVariantGroup(id: string): Promise<ActionResult> {
  const u = await requireUser();
  await db().delete(variantGroups).where(and(eq(variantGroups.id, id), eq(variantGroups.userId, u.id)));
  return done();
}

/* ---------- kategori menu ---------- */
export async function addCategory(nameRaw: string): Promise<ActionResult> {
  const u = await requireUser();
  const name = String(nameRaw ?? "").trim().slice(0, 40);
  if (!name) return fail("Nama kategori wajib diisi.");
  const [m] = await db().select({ m: max(categories.sort) }).from(categories).where(eq(categories.userId, u.id));
  await db().insert(categories).values({ userId: u.id, name, sort: (m.m ?? -1) + 1 });
  return done();
}

export async function renameCategory(id: string, nameRaw: string): Promise<ActionResult> {
  const u = await requireUser();
  const name = String(nameRaw ?? "").trim().slice(0, 40);
  if (!name) return fail("Nama kategori wajib diisi.");
  await db().update(categories).set({ name }).where(and(eq(categories.id, id), eq(categories.userId, u.id)));
  return done();
}

export async function moveCategory(id: string, dir: -1 | 1): Promise<ActionResult> {
  const u = await requireUser();
  const list = await db().select({ id: categories.id, sort: categories.sort }).from(categories)
    .where(eq(categories.userId, u.id)).orderBy(asc(categories.sort), asc(categories.name));
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return done();
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, k) => (x.sort === k ? null : db().update(categories).set({ sort: k }).where(eq(categories.id, x.id)))));
  return done();
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const u = await requireUser();
  const used = await db().select({ id: menuItems.id }).from(menuItems)
    .where(and(eq(menuItems.userId, u.id), eq(menuItems.categoryId, id))).limit(1);
  if (used.length) return fail("Kategori ini masih berisi menu, jadi tidak bisa dihapus.");
  await db().delete(categories).where(and(eq(categories.id, id), eq(categories.userId, u.id)));
  return done();
}
