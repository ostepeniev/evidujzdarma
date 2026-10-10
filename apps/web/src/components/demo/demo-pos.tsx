"use client";

import { useState } from "react";
import { PAYMENT_LABEL, lineTotal, type SaleLine } from "@ez/fiscal-core";
import { RegisterScreen, type CartLine } from "@/components/pos/register-screen";
import { Sheet, kc } from "@/components/pos/ui";
import type { PosConfig } from "@/lib/pos/types";

/**
 * Ukázka pokladny bez registrace (R17.5). Hlavní obrazovka je skutečná RegisterScreen z pokladny, napojená na stav
 * v paměti (adaptér místo konfigurace ze serveru). Platba a účtenka jsou zjednodušené kopie: PaymentSheet a ReceiptView
 * pokladny pracují s QR platbou, poukazy, IndexedDB a odesláním do FS. Nic se neukládá (ani do prohlížeče) a nic se
 * neodesílá – po obnovení stránky začíná ukázka znovu.
 */

export const DEMO_CATALOG: PosConfig["catalog"] = [
  { id: "kava", name: "Káva", price: 5900, vatRate: 0, color: "#7c4a2d" },
  { id: "cappuccino", name: "Cappuccino", price: 6900, vatRate: 0, color: "#a8693f" },
  { id: "croissant", name: "Croissant", price: 4500, vatRate: 0, color: "#d9a441" },
  { id: "bageta", name: "Bageta", price: 8900, vatRate: 0, color: "#c2873b" },
  { id: "voda", name: "Voda", price: 3500, vatRate: 0, color: "#3b82c4" },
  { id: "dort", name: "Dort", price: 7900, vatRate: 0, color: "#c2416b" },
];

/** Místo FIK/BKP na účtence (R17.5, doslovně). */
export const DEMO_RECEIPT_NOTE = "Ukázka – účtenka nebyla odeslána Finanční správě";

/** Konfigurace pokladny jen v paměti – RegisterScreen z ní bere katalog a plátcovství DPH. */
const DEMO_CONFIG: PosConfig = {
  fetchedAt: "1970-01-01T00:00:00.000Z",
  device: { id: "demo", name: "Ukázka", registerId: "DEMO", sequencePrefix: "DEMO-", unitId: null },
  account: { id: "demo", name: "Ukázka", ico: null, dic: null, vatPayer: false, iban: null, receiptHeader: null, receiptFooter: null, mode: "mock", plan: "free" },
  units: [],
  staff: [],
  catalog: DEMO_CATALOG,
};

type Method = "cash" | "card";
const METHODS: Method[] = ["cash", "card"];

export function DemoPos() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState<{ lines: SaleLine[]; discount: number; method: Method } | null>(null);
  const total = cart.reduce((s, l) => s + lineTotal(l), 0) - discount;

  if (paid) {
    return (
      <DemoReceipt
        lines={paid.lines}
        discount={paid.discount}
        method={paid.method}
        onNew={() => {
          setPaid(null);
          setCart([]);
          setDiscount(0);
        }}
      />
    );
  }

  return (
    <>
      <RegisterScreen config={DEMO_CONFIG} cart={cart} setCart={setCart} discount={discount} setDiscount={setDiscount} onPay={() => setPaying(true)} />
      {paying && (
        <Sheet title={`Platba ${kc(total)}`} onClose={() => setPaying(false)}>
          <div className="grid grid-cols-2 gap-3">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                className="btn-primary py-5 text-lg"
                onClick={() => {
                  setPaid({ lines: cart.map(({ key: _key, ...l }) => l), discount, method: m });
                  setPaying(false);
                }}
              >
                {PAYMENT_LABEL[m]}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

export function DemoReceipt({ lines, discount = 0, method, onNew }: { lines: SaleLine[]; discount?: number; method: Method; onNew: () => void }) {
  const total = lines.reduce((s, l) => s + lineTotal(l), 0) - discount;
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <div className="rounded-2xl border border-line bg-white p-5 font-mono text-sm shadow-sm">
        <ul className="space-y-1">
          {lines.map((l) => (
            <li key={`${l.name}-${l.unitPrice}`} className="flex justify-between gap-3">
              <span>
                {l.qty}× {l.name}
              </span>
              <span className="tabular-nums">{kc(lineTotal(l))}</span>
            </li>
          ))}
          {discount > 0 && (
            <li className="flex justify-between gap-3">
              <span>Sleva</span>
              <span className="tabular-nums">−{kc(discount)}</span>
            </li>
          )}
        </ul>
        <p className="mt-3 flex justify-between border-t border-line pt-3 text-base font-bold">
          <span>Celkem</span>
          <span className="tabular-nums">{kc(total)}</span>
        </p>
        <p className="mt-1 text-muted">{PAYMENT_LABEL[method]}</p>
        <p className="mt-4 rounded-lg bg-sun-100 p-2 text-center font-sans text-[13px] font-semibold text-warn-700">{DEMO_RECEIPT_NOTE}</p>
      </div>
      <button type="button" className="btn-secondary w-full" onClick={onNew}>
        Nový prodej
      </button>
    </div>
  );
}
