export type CategoryDTO = { id: string; name: string };
export type VariantOptionDTO = { id: string; name: string; price: number };
export type VariantGroupDTO = { id: string; name: string; required: boolean; options: VariantOptionDTO[] };
export type MenuItemDTO = {
  id: string;
  name: string;
  price: number;
  categoryId: string | null;
  /** Kode versi gambar untuk cache; null jika menu tidak punya foto. */
  imgVer: string | null;
  favorite: boolean;
  unlimitedStock: boolean;
  stock: number;
  soldOut: boolean;
  groupIds: string[];
};
export type MenuData = { categories: CategoryDTO[]; groups: VariantGroupDTO[]; items: MenuItemDTO[] };

export type ActionResult = { ok: true } | { ok: false; error: string };

export type MenuItemInput = {
  id?: string;
  name: string;
  price: number;
  categoryId: string | null;
  groupIds: string[];
  unlimitedStock: boolean;
  stock: number;
  /** undefined = biarkan, "" = hapus foto, data URL = foto baru */
  image?: string;
};
export type VariantGroupInput = {
  id?: string;
  name: string;
  required: boolean;
  options: { name: string; price: number }[];
};

import type { Discount } from "./calc";
export type OrderType = "Makan di tempat" | "Bawa pulang" | "Ojol";
export type PaymentInput =
  | { kind: "cash"; received: number }
  | { kind: "qris" }
  | { kind: "split"; cash: number }
  | { kind: "later" };
export type CreateOrderInput = {
  customerName: string;
  orderType: OrderType;
  tableNo: string;
  lines: { menuItemId: string; qty: number; note: string; optionIds: string[]; discount: Discount }[];
  discount: Discount;
  payment: PaymentInput;
};
export type CreateOrderResult =
  | { ok: true; order: { id: string; number: number; total: number; change: number; status: "paid" | "unpaid"; customerName: string } }
  | { ok: false; error: string };

export type OrderRowDTO = {
  id: string;
  number: number;
  createdAt: string;
  paidAt: string | null;
  customerName: string;
  orderType: string;
  tableNo: string;
  total: number;
  status: "paid" | "unpaid";
  wasPayLater: boolean;
  methods: ("cash" | "qris")[];
  itemsText: string;
};
export type ReceiptDTO = {
  shop: string; address: string; whatsapp: string; footer: string; paperWidth: number;
  number: number; createdAt: string; customerName: string; orderType: string; tableNo: string;
  items: { qty: number; name: string; options: { name: string; price: number }[]; note: string; base: number; discount: number }[];
  subtotal: number; orderDiscount: number; total: number; status: "paid" | "unpaid";
  payments: { method: "cash" | "qris"; amount: number }[];
  cashReceived: number; change: number;
};
export type SettleInput = { kind: "cash"; received: number } | { kind: "qris" } | { kind: "split"; cash: number };

/** Isi pesanan belum lunas untuk dipilih saat "bayar sebagian". */
export type OrderLinesDTO = {
  id: string; number: number; customerName: string;
  discount: { mode: "rp" | "pct"; value: number };
  lines: { id: string; name: string; options: string[]; note: string; price: number; optionsTotal: number; qty: number; discount: { mode: "rp" | "pct"; value: number } }[];
};
export type PartialResult = { ok: true; orderId: string; number: number; remaining: number } | { ok: false; error: string };
export type AddItemsResult = { ok: true; number: number; total: number } | { ok: false; error: string };
