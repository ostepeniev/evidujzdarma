"use client";

import { useState } from "react";
import { verifyStaffPin } from "@/lib/pos/sync";
import type { PosConfig } from "@/lib/pos/types";
import { Keypad, Sheet } from "./ui";

/**
 * Vratku schvaluje vlastník PINem, který ověří server (R3.10) – otisk PINu vlastníka v zařízení není.
 * Server vrátí schválení podepsané pro toto zařízení; bez něj vratku nepřijme.
 */
export function OwnerApproval({ config, onApprove, onClose }: { config: PosConfig; onApprove: (approval: string) => void; onClose: () => void }) {
  const owners = config.staff.filter((s) => s.role === "owner");
  const [selected, setSelected] = useState(owners.length === 1 ? owners[0]! : null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function tryPin(value: string) {
    if (!selected || busy) return;
    setBusy(true);
    const r = await verifyStaffPin(selected.id, value, "refund");
    setBusy(false);
    if (r.ok && r.approval) onApprove(r.approval);
    else {
      setError(r.ok ? "Vratku může schválit jen vlastník." : r.error);
      setPin("");
    }
  }

  return (
    <Sheet title="Vratku schvaluje vlastník" onClose={onClose}>
      {owners.length === 0 ? (
        <p className="text-[15px] text-ink-soft">Účet nemá aktivního vlastníka. Vratku nelze schválit.</p>
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
          <p className="mb-3 text-center text-[15px] text-ink-soft">PIN vlastníka ({selected.name}) – ověří se online</p>
          <div className="mb-4 flex justify-center gap-3" aria-label="Zadaný PIN" aria-live="polite">
            {Array.from({ length: Math.max(6, pin.length) }).map((_, i) => (
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
