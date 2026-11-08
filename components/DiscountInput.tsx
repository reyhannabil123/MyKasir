"use client";

import { useState } from "react";
import type { Discount } from "@/lib/calc";
import { MoneyInput } from "./MoneyInput";

export function DiscountInput({ value, onChange, placeholder = "Diskon" }: { value: Discount; onChange: (d: Discount) => void; placeholder?: string }) {
  const [txt, setTxt] = useState(value.mode === "pct" && value.value ? String(value.value) : "");
  return (
    <div className="discrow">
      <div className="seg" role="group" aria-label="Jenis diskon">
        {(["rp", "pct"] as const).map((m) => (
          <button key={m} type="button" className={value.mode === m ? "on" : ""}
            onClick={() => { setTxt(""); onChange({ mode: m, value: 0 }); }}>{m === "rp" ? "Rp" : "%"}</button>
        ))}
      </div>
      {value.mode === "rp" ? (
        <MoneyInput value={value.value} onChange={(n) => onChange({ mode: "rp", value: n })} placeholder={placeholder} aria-label="Diskon dalam rupiah" />
      ) : (
        <input className="in mono" inputMode="decimal" placeholder={placeholder} value={txt} aria-label="Diskon dalam persen"
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d.,]/g, "");
            setTxt(t);
            onChange({ mode: "pct", value: Math.min(100, parseFloat(t.replace(",", ".")) || 0) });
          }} />
      )}
    </div>
  );
}
