"use client";

import { useState } from "react";
import { lineTotal, type SaleLine } from "@ez/fiscal-core";
import type { PosConfig } from "@/lib/pos/types";
import { Keypad, Sheet, applyKey, kc, parseKc } from "./ui";

export interface CartLine extends SaleLine {
  key: string;
}

export function RegisterScreen({
  config,
  cart,
  setCart,
  discount,
  setDiscount,
  onPay,
}: {
  config: PosConfig;
  cart: CartLine[];
  setCart: (c: CartLine[]) => void;
  discount: number;
  setDiscount: (d: number) => void;
  onPay: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const defaultVat = config.account.vatPayer ? 21 : 0;
  const gross = cart.reduce((s, l) => s + lineTotal(l), 0);
  const total = gross - discount;

  function addLine(line: Omit<CartLine, "key">) {
    const existing = cart.find((c) => c.name === line.name && c.unitPrice === line.unitPrice && c.vatRate === line.vatRate);
    if (existing) setCart(cart.map((c) => (c === existing ? { ...c, qty: c.qty + line.qty } : c)));
    else setCart([...cart, { ...line, key: crypto.randomUUID() }]);
  }

  function addAmount() {
    const h = parseKc(amount);
    if (!h || h <= 0) return;
    addLine({ name: label.trim() || "Položka", qty: 1, unitPrice: h, vatRate: defaultVat });
    setAmount("");
    setLabel("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <section aria-label="Zadání položek" className="space-y-4">
        {config.catalog.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {config.catalog.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addLine({ name: item.name, qty: 1, unitPrice: item.price, vatRate: item.vatRate })}
                className="min-h-16 rounded-2xl border border-line bg-white p-3 text-left active:scale-[0.98]"
                style={item.color ? { borderLeft: `6px solid ${item.color}` } : undefined}
              >
                <span className="block text-[15px] font-semibold leading-tight text-ink">{item.name}</span>
                <span className="text-sm text-ink-soft">{kc(item.price)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="rounded-3xl border border-line bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <input
              aria-label="Název položky (nepovinné)"
              placeholder="Název (nepovinné)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
              maxLength={80}
            />
            <output className="text-3xl font-extrabold tabular-nums text-ink" aria-live="polite">
              {amount || "0"} Kč
            </output>
          </div>
          <div className="mt-3">
            <Keypad onKey={(k) => setAmount((v) => applyKey(v, k))} />
          </div>
          <button type="button" onClick={addAmount} disabled={!parseKc(amount)} className="btn-secondary mt-3 w-full py-3 text-lg">
            + Přidat částku
          </button>
        </div>
      </section>

      <section aria-label="Účet" className="flex flex-col rounded-3xl border border-line bg-white p-4">
        <h2 className="text-lg font-bold">Účet</h2>
        {cart.length === 0 ? (
          <p className="my-8 text-center text-muted">Zatím nic. Zadejte částku nebo klepněte na zboží.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {cart.map((l) => (
              <li key={l.key} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="text-sm text-muted">
                    {kc(l.unitPrice)}
                    {config.account.vatPayer && <> · DPH {l.vatRate} %</>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Ubrat ${l.name}`}
                    onClick={() => setCart(l.qty <= 1 ? cart.filter((c) => c.key !== l.key) : cart.map((c) => (c.key === l.key ? { ...c, qty: c.qty - 1 } : c)))}
                    className="h-9 w-9 rounded-full border border-line text-lg"
                  >
                    −
                  </button>
                  <span className="w-7 text-center font-semibold tabular-nums">{l.qty}</span>
                  <button type="button" aria-label={`Přidat ${l.name}`} onClick={() => setCart(cart.map((c) => (c.key === l.key ? { ...c, qty: c.qty + 1 } : c)))} className="h-9 w-9 rounded-full border border-line text-lg">
                    +
                  </button>
                </div>
                <span className="w-24 text-right font-semibold tabular-nums">{kc(lineTotal(l))}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto space-y-2 pt-4">
          {cart.length > 0 && (
            <div className="flex items-center justify-between text-[15px]">
              <button type="button" onClick={() => setDiscountOpen(true)} className="font-medium text-brand-700 underline underline-offset-4">
                {discount ? "Upravit slevu" : "Přidat slevu"}
              </button>
              {discount > 0 && <span className="text-ink-soft">Sleva −{kc(discount)}</span>}
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold">Celkem</span>
            <span className="text-3xl font-extrabold tabular-nums">{kc(total)}</span>
          </div>
          <button type="button" disabled={cart.length === 0 || total <= 0} onClick={onPay} className="btn-primary w-full py-4 text-xl">
            Zaplatit
          </button>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCart([]);
                setDiscount(0);
              }}
              className="w-full py-2 text-[15px] text-ink-soft hover:text-ink"
            >
              Zrušit účet
            </button>
          )}
        </div>
      </section>

      {discountOpen && <DiscountSheet gross={gross} current={discount} onClose={() => setDiscountOpen(false)} onSave={(d) => (setDiscount(d), setDiscountOpen(false))} />}
    </div>
  );
}

function DiscountSheet({ gross, current, onClose, onSave }: { gross: number; current: number; onClose: () => void; onSave: (d: number) => void }) {
  const [mode, setMode] = useState<"kc" | "pct">("pct");
  const [value, setValue] = useState(current ? String(current / 100) : "");
  const parsed = parseKc(value || "0") ?? 0;
  const discount = Math.min(gross, mode === "pct" ? Math.round((gross * Math.min(parsed / 100, 100)) / 100) : parsed);
  return (
    <Sheet title="Sleva" onClose={onClose}>
      <div className="flex gap-2">
        {(
          [
            ["pct", "Procenta"],
            ["kc", "Částka"],
          ] as const
        ).map(([m, l]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`flex-1 rounded-xl border py-2 font-semibold ${mode === m ? "border-brand-600 bg-brand-600 text-white" : "border-line"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        {(mode === "pct" ? ["5", "10", "15", "20"] : ["10", "20", "50", "100"]).map((v) => (
          <button key={v} type="button" onClick={() => setValue(v)} className="flex-1 rounded-full border border-line py-2 text-sm font-medium">
            {v} {mode === "pct" ? "%" : "Kč"}
          </button>
        ))}
      </div>
      <input aria-label="Výše slevy" inputMode="decimal" className="input mt-3 text-lg" value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === "pct" ? "%" : "Kč"} />
      <p className="mt-3 text-center text-lg">
        Sleva <strong>{kc(discount)}</strong> → zaplatí {kc(gross - discount)}
      </p>
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={() => onSave(0)}>
          Bez slevy
        </button>
        <button type="button" className="btn-primary flex-1" onClick={() => onSave(discount)}>
          Použít
        </button>
      </div>
    </Sheet>
  );
}
