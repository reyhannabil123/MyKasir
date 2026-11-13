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

export type SplitLine = { id: string; price: number; optionsTotal: number; qty: number; discount: Discount };
type Part = { lines: SplitLine[]; discount: Discount; calc: ReturnType<typeof calcOrder> };

/**
 * Memecah pesanan menjadi bagian yang dibayar sekarang (`sel`: id baris -> jumlah) dan sisanya.
 * - Diskon item persen ikut sama; diskon item Rp dibagi sesuai jumlah.
 * - Diskon pesanan persen berlaku sama di kedua bagian; diskon pesanan Rp dibagi sebanding nilai item.
 */
export function splitOrder(lines: SplitLine[], discount: Discount, sel: Map<string, number>): { paid: Part; remain: Part } {
  const paidL: SplitLine[] = [], remL: SplitLine[] = [];
  for (const l of lines) {
    const s = Math.min(l.qty, Math.max(0, sel.get(l.id) ?? 0));
    if (s <= 0) { remL.push(l); continue; }
    let pd: Discount = l.discount, rd: Discount = l.discount;
    if (l.discount.mode === "rp") {
      const eff = Math.min(l.discount.value, (l.price + l.optionsTotal) * l.qty);
      const part = Math.round((eff * s) / l.qty);
      pd = { mode: "rp", value: part }; rd = { mode: "rp", value: eff - part };
    }
    paidL.push({ ...l, qty: s, discount: pd });
    if (l.qty - s > 0) remL.push({ ...l, qty: l.qty - s, discount: rd });
  }
  const net = (ls: SplitLine[]) => ls.reduce((a, l) => a + lineCalc(l).net, 0);
  const pNet = net(paidL), rNet = net(remL), tot = pNet + rNet;
  let pDisc = discount, rDisc = discount;
  if (discount.mode === "rp") {
    const eff = Math.min(discount.value, tot);
    const pv = tot > 0 ? Math.round((eff * pNet) / tot) : 0;
    pDisc = { mode: "rp", value: pv }; rDisc = { mode: "rp", value: eff - pv };
  }
  return {
    paid: { lines: paidL, discount: pDisc, calc: calcOrder(paidL, pDisc) },
    remain: { lines: remL, discount: rDisc, calc: calcOrder(remL, rDisc) },
  };
}
