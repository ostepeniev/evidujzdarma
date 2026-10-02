"use client";

import { useState } from "react";
import { verifyPin } from "@/lib/pos/pin";
import type { PosConfig } from "@/lib/pos/types";
import { Keypad, Sheet } from "./ui";

/** Vratku pokladní dělá jen se schválením vlastníka – PIN se ověří přímo v zařízení (i offline). */
export function OwnerApproval({ config, onApprove, onClose }: { config: PosConfig; onApprove: (ownerId: string) => void; onClose: () => void }) {
  const owners = config.staff.filter((s) => s.role === "owner" && s.pinHash);
  const [selected, setSelected] = useState(owners.length === 1 ? owners[0]! : null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function tryPin(value: string) {
    if (!selected) return;
    if (await verifyPin(value, selected.pinHash)) onApprove(selected.id);
    else {
      setError("Nesprávný PIN");
      setPin("");
    }
  }

  return (
    <Sheet title="Vratku schvaluje vlastník" onClose={onClose}>
      {owners.length === 0 ? (
        <p className="text-[15px] text-ink-soft">Vratku může udělat jen vlastník. Aby ji mohl schválit i na pokladně pokladní, nastavte vlastníkovi PIN v nastavení pokladny (Personál).</p>
      ) : !selected ? (
        <ul className="grid gap-2">
          {owners.map((o) => (
            <li key={o.id}>
              <button type="button" className="w-full rounded-2xl border border-line px-4 py-3 text-left font-semibold hover:border-brand-500" onClick={() => setSelected(o)}>
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <p className="mb-3 text-center text-[15px] text-ink-soft">PIN vlastníka ({selected.name})</p>
          <div className="mb-4 flex justify-center gap-3" aria-label="Zadaný PIN" aria-live="polite">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-brand-600" : "bg-surface-2"}`} />
            ))}
          </div>
          {error && (
            <p role="alert" className="mb-3 text-center text-danger-600">
              {error}
            </p>
          )}
          <Keypad
            keys={["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"]}
            onKey={(k) => {
              setError(null);
              if (k === "⌫") setPin((p) => p.slice(0, -1));
              else if (k === "OK") void tryPin(pin);
              else if (pin.length < 8) setPin(pin + k);
            }}
          />
        </div>
      )}
    </Sheet>
  );
}
