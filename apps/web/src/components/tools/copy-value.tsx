"use client";

import { useState } from "react";

/** S2 B1: hodnota s tlačítkem Kopírovat (IBAN, číslo účtu). Schránka jen na kliknutí, nic se neukládá. */
export function CopyValue({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <span className={`text-xl font-bold text-ink ${mono ? "font-mono tracking-wide" : ""}`}>{value}</span>
        <button
          type="button"
          className="btn-secondary px-3 py-1 text-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Zkopírováno" : "Kopírovat"}
        </button>
      </div>
    </div>
  );
}
