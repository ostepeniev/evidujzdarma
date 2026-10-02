"use client";

import { useState } from "react";
import { getMeta, setMeta } from "@/lib/pos/db";
import { verifyPin } from "@/lib/pos/pin";
import { pinLockUntil } from "@/lib/pos/pin-attempts";
import { verifyStaffPin } from "@/lib/pos/sync";
import type { PosConfig } from "@/lib/pos/types";
import { Keypad } from "./ui";

type StaffEntry = PosConfig["staff"][number];

/**
 * Přihlášení obsluhy. PIN pokladní se ověří v zařízení (funguje offline) s rostoucí prodlevou po chybách;
 * PIN vlastníka jen online na serveru (R3.10).
 */
export function PinLock({ config, onUnlock }: { config: PosConfig; onUnlock: (staff: { id: string; name: string }) => void }) {
  const [selected, setSelected] = useState<StaffEntry | null>(config.staff.length === 1 ? config.staff[0]! : null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function tryPin(value: string) {
    if (!selected || busy) return;
    if (!selected.pinHash && !selected.onlinePin) {
      onUnlock({ id: selected.id, name: selected.name });
      return;
    }
    setBusy(true);
    try {
      if (selected.onlinePin) {
        const r = await verifyStaffPin(selected.id, value, "unlock");
        if (r.ok) onUnlock({ id: selected.id, name: selected.name });
        else fail(r.error);
        return;
      }
      const key = `pinFailures:${selected.id}`;
      const state = (await getMeta<{ failures: number; lockedUntil: number }>(key)) ?? { failures: 0, lockedUntil: 0 };
      if (state.lockedUntil > Date.now()) {
        fail(`Příliš mnoho chybných pokusů. Zkuste to za ${Math.ceil((state.lockedUntil - Date.now()) / 1000)} s.`);
        return;
      }
      if (await verifyPin(value, selected.pinHash)) {
        await setMeta(key, { failures: 0, lockedUntil: 0 });
        onUnlock({ id: selected.id, name: selected.name });
      } else {
        const failures = state.failures + 1;
        await setMeta(key, { failures, lockedUntil: pinLockUntil(failures) });
        fail("Nesprávný PIN");
      }
    } finally {
      setBusy(false);
    }
  }

  function fail(message: string) {
    setError(message);
    setPin("");
  }

  const minLength = selected?.onlinePin ? 6 : 4;
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
                  if (!s.pinHash && !s.onlinePin) onUnlock({ id: s.id, name: s.name });
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
          {selected.onlinePin && <p className="mb-3 text-center text-sm text-muted">PIN vlastníka se ověřuje online. Bez signálu se přihlaste jako pokladní.</p>}
          <div className="mb-4 flex justify-center gap-3" aria-label="Zadaný PIN" aria-live="polite">
            {Array.from({ length: Math.max(minLength, pin.length) }).map((_, i) => (
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
