import {
  pgTable, uuid, text, integer, boolean, timestamp, doublePrecision, jsonb, primaryKey, unique, index,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Satu akun = satu usaha. */
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  shopName: text("shop_name").notNull(),
  address: text("address").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  /** Gambar QRIS toko (data URL, sudah diperkecil). Kosong = QRIS belum diupload. */
  qrisImage: text("qris_image").notNull().default(""),
  paperWidth: integer("paper_width").notNull().default(58),
  receiptFooter: text("receipt_footer").notNull().default("Terima kasih, sampai jumpa lagi!"),
  theme: text("theme").notNull().default("auto"),
  createdAt: createdAt(),
});

export const categories = pgTable("categories", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
}, (t) => [index("categories_user_idx").on(t.userId)]);

export const variantGroups = pgTable("variant_groups", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** true = wajib dipilih (pilih 1), false = opsional (boleh lebih dari satu). */
  required: boolean("required").notNull().default(false),
  sort: integer("sort").notNull().default(0),
}, (t) => [index("variant_groups_user_idx").on(t.userId)]);

export const variantOptions = pgTable("variant_options", {
  id: id(),
  groupId: uuid("group_id").notNull().references(() => variantGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  sort: integer("sort").notNull().default(0),
});

export const menuItems = pgTable("menu_items", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  image: text("image").notNull().default(""),
  favorite: boolean("favorite").notNull().default(false),
  unlimitedStock: boolean("unlimited_stock").notNull().default(true),
  stock: integer("stock").notNull().default(0),
  soldOut: boolean("sold_out").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("menu_items_user_idx").on(t.userId)]);

export const menuItemVariantGroups = pgTable("menu_item_variant_groups", {
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => variantGroups.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.menuItemId, t.groupId] })]);

export const orders = pgTable("orders", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Nomor urut pesanan per usaha. */
  number: integer("number").notNull(),
  createdAt: createdAt(),
  customerName: text("customer_name").notNull().default(""),
  orderType: text("order_type").notNull().default("Makan di tempat"),
  tableNo: text("table_no").notNull().default(""),
  subtotal: integer("subtotal").notNull(),
  itemDiscount: integer("item_discount").notNull().default(0),
  orderDiscountMode: text("order_discount_mode").notNull().default("rp"),
  orderDiscountValue: doublePrecision("order_discount_value").notNull().default(0),
  orderDiscount: integer("order_discount").notNull().default(0),
  total: integer("total").notNull(),
  /** "paid" | "unpaid" */
  status: text("status").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  /** true jika pesanan ini pernah masuk daftar bayar nanti. */
  wasPayLater: boolean("was_pay_later").notNull().default(false),
  cashReceived: integer("cash_received").notNull().default(0),
  changeGiven: integer("change_given").notNull().default(0),
}, (t) => [
  unique("orders_user_number_uq").on(t.userId, t.number),
  index("orders_user_created_idx").on(t.userId, t.createdAt),
]);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: uuid("menu_item_id").references(() => menuItems.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  qty: integer("qty").notNull(),
  note: text("note").notNull().default(""),
  /** [{ name, price }] varian yang dipilih saat pesanan dibuat. */
  options: jsonb("options").$type<{ name: string; price: number }[]>().notNull().default([]),
  discountMode: text("discount_mode").notNull().default("rp"),
  discountValue: doublePrecision("discount_value").notNull().default(0),
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  /** "cash" | "qris" */
  method: text("method").notNull(),
  amount: integer("amount").notNull(),
});

export const expenses = pgTable("expenses", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  createdAt: createdAt(),
}, (t) => [index("expenses_user_idx").on(t.userId, t.createdAt)]);

export const cashClosings = pgTable("cash_closings", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  openingCash: integer("opening_cash").notNull(),
  expectedCash: integer("expected_cash").notNull(),
  countedCash: integer("counted_cash").notNull(),
  createdAt: createdAt(),
});
