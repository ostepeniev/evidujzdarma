"use client";

import { useMemo, useState } from "react";
import { formatReceiptDate } from "@ez/fiscal-core";
import { fullSelection, refundableLines } from "@/lib/pos/refund";
import { refundDraft, refundRemaining, type RefundSource } from "@/lib/pos/sale-factory";
import { Sheet, kc } from "./ui";

export type RefundDraft = ReturnType<typeof refundDraft>;

const qtyFmt = (q: number) => String(Math.round(q * 1000) / 1000).replace(".", ",");

/**
 * S3-POKLADNA: výběr, co vrátit – celý doklad, nebo jen vybrané položky a množství. Dřívější vratky (i z jiných pokladen)
 * se odečtou. Pak následuje schválení vlastníkem a vrácení peněz (stejné jako dřív).
 */
export function RefundSheet({ source, onClose, onContinue }: { source: RefundSource; onClose: () => void; onContinue: (draft: RefundDraft) => void }) {
  const rows = useMemo(() => refundableLines(source.lines, source.refunds), [source]);
  const [sel, setSel] = useState<Record<number, number>>(() => fullSelection(rows));
  const draft = useMemo(() => refundDraft(source, sel), [source, sel]);
  const refundedBefore = source.subtotal - refundRemaining(source);
  const set = (i: number, q: number) => setSel((s) => ({ ...s, [i]: q }));

  return (
    <Sheet title="Vratka" onClose={onClose} wide>
      <p className="text-[15px] text-ink-soft">
        Doklad <strong className="text-ink">{source.sequence}</strong> · {formatReceiptDate(source.soldAt)}
        {source.unitLabel && <> · {source.unitLabel}</>}
        {source.remote && <> · z jiné pokladny</>}
      </p>
      {refundedBefore > 0 && (
        <p className="mt-2 rounded-xl bg-surface p-3 text-[15px]">
          Už vráceno {kc(refundedBefore)} ({source.refunds.length}× vratka). Vrátit jde jen zbytek.
        </p>
      )}
      <ul className="mt-4 divide-y divide-line rounded-2xl border border-line" aria-label="Položky k vrácení">
        {rows.map((r) => {
          const q = sel[r.index] ?? 0;
          const whole = Number.isInteger(r.remainingQty);
          const disabled = r.remainingQty <= 0;
          return (
            <li key={r.index} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.line.name}</p>
                <p className="text-sm text-muted">
                  {kc(r.line.unitPrice)} · na dokladu {qtyFmt(r.soldQty)}
                  {r.refundedQty > 0 && <> · vráceno {qtyFmt(r.refundedQty)}</>}
                </p>
              </div>
              {disabled ? (
                <span className="text-sm text-muted">vráceno</span>
              ) : whole ? (
                <div className="flex items-center gap-1">
                  <button type="button" aria-label={`Vrátit o kus méně – ${r.line.name}`} disabled={q <= 0} onClick={() => set(r.index, Math.max(0, q - 1))} className="h-9 w-9 rounded-full border border-line text-lg disabled:opacity-40">
                    −
                  </button>
                  <span className="w-12 text-center font-semibold tabular-nums" aria-label={`Vrátit kusů – ${r.line.name}`}>
                    {qtyFmt(q)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Vrátit o kus víc – ${r.line.name}`}
                    disabled={q >= r.remainingQty}
                    onClick={() => set(r.index, Math.min(r.remainingQty, q + 1))}
                    className="h-9 w-9 rounded-full border border-line text-lg disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={q > 0} onChange={(e) => set(r.index, e.target.checked ? r.remainingQty : 0)} />
                  {qtyFmt(r.remainingQty)}
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setSel(fullSelection(rows))}>
          Vrátit vše
        </button>
        <button type="button" className="text-ink-soft underline" onClick={() => setSel({})}>
          Nic nevracet
        </button>
      </div>
      {source.tip > 0 && <p className="mt-3 text-sm text-muted">Spropitné {kc(source.tip)} se nevrací.</p>}
      <p className="mt-4 flex items-baseline justify-between text-lg">
        <span>Vrátit zákazníkovi</span>
        <strong className="text-2xl tabular-nums">{kc(Math.abs(draft.total))}</strong>
      </p>
      <button type="button" className="btn-primary mt-4 w-full py-4 text-lg" disabled={draft.total >= 0} onClick={() => onContinue(draft)}>
        Pokračovat – schválení vlastníkem
      </button>
    </Sheet>
  );
}

/** Hledání dokladu pro vratku – i z jiné pokladny účtu nebo starší než 7 dní (Historie ukazuje 7 dní). */
export function RefundLookupForm({ onFind, busy }: { onFind: (q: string) => void; busy: boolean }) {
  const [q, setQ] = useState("");
  return (
    <form
      className="rounded-2xl border border-line bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) onFind(q.trim());
      }}
    >
      <label htmlFor="refund-q" className="label">
        Vratka k jinému dokladu – číslo dokladu z účtenky
      </label>
      <div className="flex gap-2">
        <input id="refund-q" className="input" placeholder="např. P1-AB12-000123" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} />
        <button type="submit" className="btn-secondary shrink-0" disabled={busy || !q.trim()}>
          {busy ? "Hledám…" : "Najít"}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">Najde doklad z kterékoli pokladny vašeho účtu, i starší než 7 dní. Potřebuje internet.</p>
    </form>
  );
}
