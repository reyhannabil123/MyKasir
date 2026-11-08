import { asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { categories, menuItems, menuItemVariantGroups, variantGroups, variantOptions } from "./schema";
import type { MenuData, MenuItemDTO } from "./types";

export const isAvailable = (m: Pick<MenuItemDTO, "soldOut" | "unlimitedStock" | "stock">) =>
  !m.soldOut && (m.unlimitedStock || m.stock > 0);

export async function loadMenu(userId: string, conn: ReturnType<typeof db> = db()): Promise<MenuData> {
  const db = () => conn;
  const [cats, groups, opts, items, links] = await Promise.all([
    db().select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.sort), asc(categories.name)),
    db().select().from(variantGroups).where(eq(variantGroups.userId, userId)).orderBy(asc(variantGroups.sort), asc(variantGroups.name)),
    db().select({ o: variantOptions }).from(variantOptions)
      .innerJoin(variantGroups, eq(variantOptions.groupId, variantGroups.id))
      .where(eq(variantGroups.userId, userId)).orderBy(asc(variantOptions.sort)),
    db().select({
      id: menuItems.id, name: menuItems.name, price: menuItems.price, categoryId: menuItems.categoryId,
      favorite: menuItems.favorite, unlimitedStock: menuItems.unlimitedStock, stock: menuItems.stock,
      soldOut: menuItems.soldOut,
      imgVer: sql<string | null>`case when ${menuItems.image} = '' then null else left(md5(${menuItems.image}), 8) end`,
    }).from(menuItems).where(eq(menuItems.userId, userId)).orderBy(asc(menuItems.sort), asc(menuItems.createdAt)),
    db().select({ l: menuItemVariantGroups }).from(menuItemVariantGroups)
      .innerJoin(menuItems, eq(menuItemVariantGroups.menuItemId, menuItems.id))
      .where(eq(menuItems.userId, userId)),
  ]);
  return {
    categories: cats.map((c) => ({ id: c.id, name: c.name })),
    groups: groups.map((g) => ({
      id: g.id, name: g.name, required: g.required,
      options: opts.filter((x) => x.o.groupId === g.id).map((x) => ({ id: x.o.id, name: x.o.name, price: x.o.price })),
    })),
    items: items.map((i) => ({ ...i, groupIds: links.filter((x) => x.l.menuItemId === i.id).map((x) => x.l.groupId) })),
  };
}
