"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { buildSpayd } from "@ez/cz/spayd";
import { PAYMENT_LABEL, roundCash, type Payment, type PaymentMethod } from "@ez/fiscal-core";
import { MAX_PAYMENTS, REFUND_SWAPPABLE, splitPayments } from "@/lib/pos/split-payment";
import type { PosConfig } from "@/lib/pos/types";
import { Keypad, Sheet, applyKey, kc, parseKc } from "./ui";

export interface PaymentResult {
  /** platby tržby – u rozdělené platby víc řádků (R6.9) */
  payments: Payment[];
  tip: number;
  cashReceived: number | null;
}

// poukazy rozdělené podle semináře FS (R5.10); starší „voucher“ zůstává jen u uložených tržeb
const METHODS: PaymentMethod[] = ["cash", "card", "qr", "meal_voucher", "credit", "gift_voucher"];

export function PaymentSheet({
  total,
  config,
  sequenceHint,
  onClose,
  onPay,
  busy,
  error,
  refundPayments,
}: {
  total: number;
  config: PosConfig;
  sequenceHint: string;
  onClose: () => void;
  onPay: (r: PaymentResult) => void;
  busy: boolean;
  error: string | null;
  /** u vratky: platby zrcadlící originál (R6.9) */
  refundPayments?: Payment[];
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [tipInput, setTipInput] = useState("");
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  // rozdělená platba (R6.9): části už zaplacené jiným způsobem; zbytek jde posledním zvoleným způsobem
  const [parts, setParts] = useState<Payment[]>([]);
  const [splitOpen, setSplitOpen] = useState(false);
  const [partInput, setPartInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [refundRows, setRefundRows] = useState<Payment[]>(() => refundPayments ?? [{ method: "cash", amount: total }]);

  const remaining = total - parts.reduce((s, p) => s + p.amount, 0);
  const tip = method === "card" ? (parseKc(tipInput || "0") ?? 0) : 0;
  const due = remaining + tip;
  const receivedH = parseKc(received || "0") ?? 0;
  const change = method === "cash" && receivedH > 0 ? receivedH - due : 0;
  const quick = useMemo(() => {
    const base = Math.max(due, 0);
    const opts = [base, roundCash(base + 49), ...[10000, 20000, 50000, 100000, 200000, 500000].filter((v) => v > base)];
    return [...new Set(opts)].slice(0, 5);
  }, [due]);

  useEffect(() => {
    let cancelled = false;
    if (method !== "qr" || !config.account.iban || due <= 0) {
      setQrSvg(null);
      return;
    }
    try {
      const vs = sequenceHint.replace(/\D/g, "").slice(-10) || undefined;
      const spayd = buildSpayd({ account: config.account.iban, amount: due / 100, message: config.account.name.slice(0, 60), variableSymbol: vs });
      QRCode.toString(spayd, { type: "svg", margin: 1, width: 260, errorCorrectionLevel: "M" }).then((s) => !cancelled && setQrSvg(s));
    } catch {
      setQrSvg(null);
    }
    return () => {
      cancelled = true;
    };
  }, [method, due, config.account.iban, config.account.name, sequenceHint]);

  const isRefund = total < 0;
  const cashShort = !isRefund && method === "cash" && receivedH > 0 && receivedH < due;

  function addPart() {
    const amount = parseKc(partInput || "0") ?? 0;
    if (amount <= 0 || amount >= remaining) {
      setLocalError(`Část musí být větší než 0 a menší než zbývající částka ${kc(remaining)}.`);
      return;
    }
    setParts([...parts, { method, amount }]);
    setMethod(method === "cash" ? "card" : "cash");
    setPartInput("");
    setReceived("");
    setTipInput("");
    setSplitOpen(false);
    setLocalError(null);
  }

  function confirm() {
    if (isRefund) return onPay({ payments: refundRows, tip: 0, cashReceived: null });
    try {
      const payments = splitPayments(parts, method, total, tip);
      onPay({ payments, tip, cashReceived: method === "cash" && receivedH > 0 ? receivedH : null });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Platbu nelze rozdělit.");
    }
  }

  return (
    <Sheet title={isRefund ? "Vrácení peněz" : "Platba"} onClose={onClose}>
      <p className="text-center text-sm text-muted">{isRefund ? "Vrátit zákazníkovi" : "K úhradě"}</p>
      <p className="text-center text-4xl font-extrabold tabular-nums">{kc(Math.abs(due))}</p>

      {isRefund && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-muted">Vrací se stejnými způsoby a ve stejném poměru, jakým zákazník platil. Hotovost, kartu, QR platbu a stravenku lze mezi sebou zaměnit.</p>
          {refundRows.map((r, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="flex justify-between font-semibold">
                <span>{PAYMENT_LABEL[r.method]}</span>
                <span className="tabular-nums">{kc(Math.abs(r.amount))}</span>
              </div>
              {REFUND_SWAPPABLE.includes(r.method) && (
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={`Způsob vrácení – ${kc(Math.abs(r.amount))}`}>
                  {REFUND_SWAPPABLE.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={r.method === m}
                      onClick={() => setRefundRows(refundRows.map((x, j) => (j === i ? { ...x, method: m } : x)))}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${r.method === m ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink"}`}
                    >
                      {PAYMENT_LABEL[m].split(" ")[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isRefund && parts.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl bg-surface p-3 text-[15px]" aria-label="Už zaplaceno">
          {parts.map((p, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>{PAYMENT_LABEL[p.method]}</span>
              <span className="flex items-center gap-3 tabular-nums">
                {kc(p.amount)}
                <button type="button" aria-label={`Odebrat ${PAYMENT_LABEL[p.method]} ${kc(p.amount)}`} onClick={() => setParts(parts.filter((_, j) => j !== i))} className="px-1 text-muted">
                  ×
                </button>
              </span>
            </li>
          ))}
          <li className="flex justify-between font-semibold">
            <span>Zbývá doplatit</span>
            <span className="tabular-nums">{kc(remaining)}</span>
          </li>
        </ul>
      )}

      {!isRefund && (
        <div className="mt-5 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Způsob platby">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={`rounded-2xl border px-2 py-3 text-sm font-semibold ${method === m ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink"}`}
            >
              {PAYMENT_LABEL[m].split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {!isRefund &&
        parts.length < MAX_PAYMENTS - 1 &&
        (splitOpen ? (
          <div className="mt-4 rounded-xl border border-line p-3">
            <label htmlFor="part" className="label">
              Část placená způsobem {PAYMENT_LABEL[method]}
            </label>
            <div className="flex gap-2">
              <input id="part" inputMode="decimal" className="input" placeholder="0" value={partInput} onChange={(e) => setPartInput(e.target.value)} />
              <button type="button" onClick={addPart} className="btn-secondary">
                Přidat
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">Zbytek pak zaplatí zákazník jiným způsobem.</p>
          </div>
        ) : (
          <button type="button" onClick={() => (setSplitOpen(true), setLocalError(null))} className="mt-3 text-sm font-semibold text-brand-700 underline">
            Rozdělit platbu – zákazník platí víc způsoby
          </button>
        ))}

      {method === "cash" && !isRefund && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-ink-soft">Přijato</span>
            <span className="text-2xl font-bold tabular-nums">{received ? `${received} Kč` : "—"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {quick.map((q) => (
              <button key={q} type="button" onClick={() => setReceived(String(q / 100).replace(".", ","))} className="rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface">
                {kc(q)}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <Keypad onKey={(k) => setReceived((v) => applyKey(v, k))} />
          </div>
          {change > 0 && (
            <p className="mt-4 rounded-2xl bg-sun-100 p-4 text-center text-xl">
              Vrátit: <strong className="tabular-nums">{kc(change)}</strong>
            </p>
          )}
          {cashShort && <p className="mt-3 text-center text-danger-600">Přijatá částka je nižší než cena.</p>}
        </div>
      )}

      {method === "card" && !isRefund && (
        <div className="mt-5">
          <label htmlFor="tip" className="label">
            Spropitné (nepovinné)
          </label>
          <input id="tip" inputMode="decimal" className="input" placeholder="0" value={tipInput} onChange={(e) => setTipInput(e.target.value)} />
          <p className="mt-2 text-sm text-muted">Platbu proveďte na svém platebním terminálu a potvrďte.</p>
        </div>
      )}

      {method === "qr" && !isRefund && (
        <div className="mt-5 text-center">
          {config.account.iban ? (
            qrSvg ? (
              <div className="mx-auto w-full max-w-[260px]" role="img" aria-label="QR kód pro platbu" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            ) : (
              <p className="text-muted">Připravuji QR kód…</p>
            )
          ) : (
            <p className="rounded-xl bg-surface p-4 text-ink-soft">Pro QR platbu doplňte číslo účtu v nastavení pokladny.</p>
          )}
          <p className="mt-2 text-sm text-muted">Zákazník naskenuje kód v bankovní aplikaci. Potvrďte až po připsání platby.</p>
        </div>
      )}

      {method === "meal_voucher" && !isRefund && (
        <p className="mt-5 rounded-xl bg-surface p-4 text-[15px] text-ink-soft">Stravenka nebo poukázka vydaná jinou firmou. Eviduje se jako běžná platba.</p>
      )}
      {method === "credit" && !isRefund && (
        <p className="mt-5 rounded-xl bg-surface p-4 text-[15px] text-ink-soft">
          Úhrada z dříve nabitého kreditu, čipu nebo předplacené karty. Eviduje se jako čerpání. Doplatek po záloze sem nepatří – zaúčtujte ho jako běžnou platbu (hotově, kartou).
        </p>
      )}
      {method === "gift_voucher" && !isRefund && (
        <p className="mt-5 rounded-xl bg-surface p-4 text-[15px] text-ink-soft">
          Dárkový poukaz na konkrétní zboží nebo službu, který jste dříve prodali. Jeho uplatnění se neeviduje – evidoval se už prodej poukazu. Doplácí-li zákazník rozdíl, rozdělte platbu: hodnotu poukazu sem, zbytek hotově nebo kartou.
        </p>
      )}

      {(localError ?? error) && (
        <p role="alert" className="mt-4 rounded-xl bg-danger-50 p-3 text-danger-600">
          {localError ?? error}
        </p>
      )}

      <button
        type="button"
        disabled={busy || cashShort}
        onClick={confirm}
        className="btn-primary mt-6 w-full py-4 text-lg"
      >
        {busy ? "Ukládám…" : isRefund ? "Potvrdit vrácení" : `Zaplaceno – ${kc(due)}`}
      </button>
    </Sheet>
  );
}
