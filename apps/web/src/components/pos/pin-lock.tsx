"use client";

import { useState } from "react";
import { verifyPin } from "@/lib/pos/pin";
import type { PosConfig } from "@/lib/pos/types";
import { Keypad } from "./ui";

export function PinLock({ config, onUnlock }: { config: PosConfig; onUnlock: (staff: { id: string; name: string }) => void }) {
  const [selected, setSelected] = useState<PosConfig["staff"][number] | null>(config.staff.length === 1 ? config.staff[0]! : null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function tryPin(value: string) {
    if (!selected) return;
    if (!selected.pinHash) {
      onUnlock({ id: selected.id, name: selected.name });
      return;
    }
    setBusy(true);
    const ok = await verifyPin(value, selected.pinHash);
    setBusy(false);
    if (ok) onUnlock({ id: selected.id, name: selected.name });
    else {
      setError("Nesprávný PIN");
      setPin("");
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-4 py-8">
      <p className="text-center text-sm text-muted">{config.account.name}</p>
      <h1 className="mt-1 text-center text-2xl font-bold">{selected ? `Ahoj, ${selected.name}` : "Kdo bude prodávat?"}</h1>
      {!selected ? (
        <ul className="mt-6 grid gap-3">
          {config.staff.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(s);
                  setError(null);
                  if (!s.pinHash) onUnlock({ id: s.id, name: s.name });
                }}
                className="w-full rounded-2xl border border-line bg-white px-5 py-4 text-left text-lg font-semibold hover:border-brand-500"
              >
                {s.name}
                <span className="ml-2 text-sm font-normal text-muted">{s.role === "owner" ? "vlastník" : "pokladní"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
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
              else if (pin.length < 8) {
                const next = pin + k;
                setPin(next);
                if (next.length >= 4 && !busy) void verifyPin(next, selected.pinHash).then((ok) => ok && onUnlock({ id: selected.id, name: selected.name }));
              }
            }}
          />
          {config.staff.length > 1 && (
            <button type="button" onClick={() => setSelected(null)} className="mt-4 w-full text-center text-[15px] text-ink-soft hover:text-ink">
              Změnit uživatele
            </button>
          )}
        </div>
      )}
    </div>
  );
}
