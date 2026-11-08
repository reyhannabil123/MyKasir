"use client";

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function MoneyInput({ value, onChange, id, placeholder = "Rp0", ...rest }:
  { value: number; onChange: (n: number) => void; id?: string; placeholder?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input {...rest} id={id} className="in mono" inputMode="numeric" placeholder={placeholder}
      value={value ? fmt(value) : ""}
      onChange={(e) => onChange(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)} />
  );
}
