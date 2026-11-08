export type Discount = { mode: "rp" | "pct"; value: number };
export const NO_DISCOUNT: Discount = { mode: "rp", value: 0 };
export type CalcLine = { price: number; optionsTotal: number; qty: number; discount: Discount };

/** Potongan dalam rupiah, tidak pernah melebihi nilai dasarnya. */
export function discOf(base: number, d: Discount): number {
  const v = d.mode === "pct" ? (base * Math.min(100, Math.max(0, d.value))) / 100 : Math.max(0, d.value);
  return Math.round(Math.min(base, v));
}

export function lineCalc(l: CalcLine) {
  const base = (l.price + l.optionsTotal) * l.qty;
  const d = discOf(base, l.discount);
  return { base, d, net: base - d };
}

export function calcOrder(lines: CalcLine[], discount: Discount) {
  let subtotal = 0, itemDiscount = 0;
  for (const l of lines) { const c = lineCalc(l); subtotal += c.base; itemDiscount += c.d; }
  const after = subtotal - itemDiscount;
  const orderDiscount = discOf(after, discount);
  return { subtotal, itemDiscount, orderDiscount, discountTotal: itemDiscount + orderDiscount, total: after - orderDiscount };
}
