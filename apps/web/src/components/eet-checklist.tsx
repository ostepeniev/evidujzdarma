"use client";

import Link from "next/link";
import { useState } from "react";
import { CHECKLIST } from "@/content/checklist";

/** Odškrtávací checklist EET 2.0 (S1). Stav jen v paměti stránky – nic se neukládá ani neodesílá; tisk = papírový seznam. */
export function EetChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const count = CHECKLIST.filter((s) => done[s.id]).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold" aria-live="polite">
          Hotovo {count} z {CHECKLIST.length}
        </p>
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          Vytisknout checklist
        </button>
      </div>
      <div className="no-print mb-6 h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${(count / CHECKLIST.length) * 100}%` }} />
      </div>
      <ol className="doc-paper card space-y-5 bg-white">
        <li className="hidden list-none text-lg font-bold print:block">Checklist EET 2.0 – co udělat do 1. 1. 2027 (evidujzdarma.cz)</li>
        {CHECKLIST.map((s, i) => (
          <li key={s.id} className="flex list-none gap-4">
            <input
              id={`ck-${s.id}`}
              type="checkbox"
              className="mt-1.5 h-5 w-5 shrink-0 accent-brand-600"
              checked={!!done[s.id]}
              onChange={(e) => setDone((d) => ({ ...d, [s.id]: e.target.checked }))}
            />
            <div className={done[s.id] ? "opacity-60" : ""}>
              <label htmlFor={`ck-${s.id}`} className="cursor-pointer">
                <span className="block text-sm font-semibold uppercase tracking-wide text-brand-700">
                  {i + 1}. {s.when}
                </span>
                <span className={`block text-lg font-bold ${done[s.id] ? "line-through" : ""}`}>{s.title}</span>
              </label>
              <p className="mt-1 text-base text-muted">{s.text}</p>
              {s.link && (
                <Link href={s.link.href} className="no-print mt-1 inline-block font-medium text-brand-700 underline">
                  {s.link.label}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
