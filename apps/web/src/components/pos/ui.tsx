"use client";

import { formatCzk } from "@ez/fiscal-core";
import type { ReactNode } from "react";
import type { LocalStatus, PosMode } from "@/lib/pos/types";

export const kc = (h: number) => formatCzk(h).replace(/ /g, " ");

/** "123,5" → haléře; null při neplatném vstupu */
export function parseKc(input: string): number | null {
  const v = input.replace(/\s+/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{0,2})?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}

export function ModeBadge({ mode }: { mode: PosMode }) {
  if (mode === "production") return <span className="chip bg-brand-600 text-white">OSTRÝ PROVOZ</span>;
  if (mode === "playground") return <span className="chip bg-sun-300 text-ink">TEST FS (Playground)</span>;
  return <span className="chip bg-surface-2 text-ink-soft">UKÁZKOVÝ REŽIM</span>;
}

const STATUS: Record<LocalStatus, { label: string; cls: string }> = {
  local: { label: "Čeká na odeslání", cls: "bg-sun-100 text-warn-700" },
  queued: { label: "Odesílá se do FS", cls: "bg-sun-100 text-warn-700" },
  sending: { label: "Odesílá se do FS", cls: "bg-sun-100 text-warn-700" },
  failed: { label: "Opakujeme odeslání", cls: "bg-sun-100 text-warn-700" },
  confirmed: { label: "Potvrzeno (POK)", cls: "bg-brand-100 text-brand-700" },
  rejected: { label: "Odmítnuto", cls: "bg-danger-50 text-danger-600" },
  not_required: { label: "Neeviduje se", cls: "bg-surface-2 text-ink-soft" },
};

export function StatusChip({ status, mode }: { status: LocalStatus; mode?: PosMode }) {
  // ukázkový „POK“ není potvrzení Finanční správy – čip to nesmí tvrdit (A r1 nové Дрібне 3)
  if (mode === "mock" && status === "confirmed") return <span className="chip bg-surface-2 text-ink-soft">Ukázka – bez FS</span>;
  const s = STATUS[status];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-6 ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-2xl leading-none text-muted hover:bg-surface" aria-label="Zavřít">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Keypad({ onKey, keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"] }: { onKey: (k: string) => void; keys?: string[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          className="h-14 rounded-2xl border border-line bg-white text-2xl font-semibold text-ink active:bg-brand-50 sm:h-16"
          aria-label={k === "⌫" ? "Smazat" : k}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

/** Úprava textového vstupu částky klávesnicí. */
export function applyKey(value: string, key: string): string {
  if (key === "⌫") return value.slice(0, -1);
  if (key === ",") return value.includes(",") ? value : `${value || "0"},`;
  if (value.includes(",") && value.split(",")[1]!.length >= 2) return value;
  if (value === "0") return key;
  if (value.replace(",", "").length >= 9) return value;
  return value + key;
}
