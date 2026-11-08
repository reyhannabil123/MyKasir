"use client";

import { useEffect } from "react";
import { Icon } from "./Icon";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sh"><h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup"><Icon n="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
