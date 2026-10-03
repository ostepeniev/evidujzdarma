/**
 * Rozdělená platba (R6.9): jedna tržba, víc způsobů platby – např. část dárkovým poukazem (neeviduje se)
 * a zbytek hotově (eviduje se). Čistá logika bez prohlížeče, aby ji šlo testovat.
 */
import type { Payment, PaymentMethod } from "@ez/fiscal-core";

/** Nejvíc plateb na tržbu – stejně jako DeviceSaleSchema na serveru. */
export const MAX_PAYMENTS = 5;

/** Způsoby, mezi kterými lze u vratky volit, aniž by se změnila evidovaná částka (vše jde do celk_trzba, bez čerpání). */
export const REFUND_SWAPPABLE: readonly PaymentMethod[] = ["cash", "card", "qr", "meal_voucher"];

/**
 * Platby tržby: pevné části (už zaplacené jiným způsobem) + zbytek posledním způsobem.
 * Spropitné patří k poslední platbě (pokladna ho nabízí jen u karty).
 */
export function splitPayments(parts: Payment[], last: PaymentMethod, total: number, tip: number): Payment[] {
  if (parts.length + 1 > MAX_PAYMENTS) throw new Error(`Nejvýš ${MAX_PAYMENTS} způsobů platby na jednu tržbu.`);
  if (parts.some((p) => !Number.isInteger(p.amount) || p.amount <= 0)) throw new Error("Částka každé části musí být kladná.");
  const paid = parts.reduce((s, p) => s + p.amount, 0);
  if (paid >= total) throw new Error("Části platby pokrývají celou částku – zbytek musí být kladný.");
  return [...parts.map((p) => ({ method: p.method, amount: p.amount })), { method: last, amount: total - paid + tip }];
}

/**
 * Platby vratky jako zrcadlo plateb originálu (R6.9): každý způsob poměrně ke své části, poslední dorovná
 * zaokrouhlení. Spropitné se nevrací (A Дрібне 17) – odečte se nejdřív z karetní platby, ke které patří.
 */
export function mirrorPayments(payments: Payment[], tip: number, refundTotal: number): Payment[] {
  const parts = payments.map((p) => ({ method: p.method, amount: p.amount }));
  let rest = Math.max(0, tip);
  for (const pass of ["card", null] as const) {
    for (let i = parts.length - 1; i >= 0 && rest > 0; i--) {
      if (pass && parts[i]!.method !== pass) continue;
      const d = Math.min(rest, Math.max(0, parts[i]!.amount));
      parts[i]!.amount -= d;
      rest -= d;
    }
  }
  const nonzero = parts.filter((p) => p.amount > 0);
  const sum = nonzero.reduce((s, p) => s + p.amount, 0);
  if (!nonzero.length || sum <= 0) return [{ method: payments[0]?.method ?? "cash", amount: refundTotal }];
  let remaining = refundTotal;
  return nonzero
    .map((p, i) => {
      const amount = i === nonzero.length - 1 ? remaining : Math.round((refundTotal * p.amount) / sum);
      remaining -= amount;
      return { method: p.method, amount };
    })
    .filter((p, i, all) => p.amount !== 0 || all.length === 1);
}
