"use client";

/** S2/B2: společné prvky peněžních kalkulaček (čistá mzda, OSVČ, spropitné). Stav jen v paměti stránky, nic se neukládá. */
import type { ReactNode } from "react";
import { kc } from "@/lib/money-2026";

export function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
  step = 1,
  min = 0,
  max,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  hint?: ReactNode;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="input pr-16"
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">{suffix}</span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Choice<T extends string | number | boolean>({
  legend,
  value,
  options,
  onChange,
  hint,
}: {
  legend: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  hint?: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`rounded-full border px-4 py-2 text-[15px] font-medium ${value === v ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-surface"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </fieldset>
  );
}

/** Řádek tabulky výsledku; `minus` = odečítaná položka. */
export function Row({ label, value, strong, soft, minus, plus }: { label: ReactNode; value: number; strong?: boolean; soft?: boolean; minus?: boolean; plus?: boolean }) {
  const cls = soft ? "font-normal text-ink-soft" : strong ? "font-bold text-ink" : "font-medium";
  return (
    <tr>
      <th scope="row" className={`py-2 pr-4 ${cls}`}>
        {label}
      </th>
      <td className={`whitespace-nowrap py-2 text-right ${strong ? "font-bold text-ink" : soft ? "text-ink-soft" : "font-semibold"}`}>
        {minus && value > 0 ? "− " : plus && value > 0 ? "+ " : ""}
        {kc(value)}
      </td>
    </tr>
  );
}

export function Warnings({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2 rounded-xl border border-sun-500 bg-sun-100 p-4 text-[15px] text-ink" role="note">
      {items.map((w) => (
        <li key={w}>{w}</li>
      ))}
    </ul>
  );
}
