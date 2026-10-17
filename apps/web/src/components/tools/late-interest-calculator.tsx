"use client";

import { useEffect, useState } from "react";
import { isIsoDate } from "@ez/cz/holidays";
import { formatCzDate, formatCzk, parseCzNumber } from "@/lib/doc-tools";
import { CNB_REPO_VERIFIED_AT, LATE_INTEREST_MARGIN, MIN_RECOVERY_COSTS, halfYearLabel, lateInterest } from "@/lib/late-interest";
import { pragueToday } from "@/lib/prague-time";
import { fragmentParam } from "@/lib/validators";

const pct = (n: number) => `${n.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const dny = (n: number) => `${n.toLocaleString("cs-CZ")} ${n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní"}`;

/**
 * S2 B1: zákonný úrok z prodlení podle NV č. 351/2013 Sb. Datum splatnosti může přijít ve fragmentu
 * (`#splatnost=2026-10-31`, odkaz z kalkulačky splatnosti); nic se neukládá ani neodesílá.
 */
export function LateInterestCalculator() {
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [paid, setPaid] = useState("");
  const [b2b, setB2b] = useState(true);

  useEffect(() => {
    const fromHash = fragmentParam(window.location.hash, "splatnost");
    if (fromHash && isIsoDate(fromHash)) setDue(fromHash);
    setPaid((v) => v || pragueToday());
  }, []);

  const n = parseCzNumber(amount);
  const ready = n !== null && due && paid;
  const r = ready ? lateInterest({ amount: n, dueDate: due, paidDate: paid }) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form className="card space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="li-amount" className="label">
            Dlužná částka
          </label>
          <div className="relative">
            <input
              id="li-amount"
              className="input pr-12 text-lg"
              inputMode="decimal"
              autoComplete="off"
              placeholder="např. 25 000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">Kč</span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="li-due" className="label">
              Den splatnosti
            </label>
            <input id="li-due" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <label htmlFor="li-paid" className="label">
              Den zaplacení
            </label>
            <input id="li-paid" type="date" className="input" value={paid} onChange={(e) => setPaid(e.target.value)} />
            <p className="mt-1 text-sm text-muted">Ještě nezaplatil? Nechte dnešek.</p>
          </div>
        </div>
        <label className="flex items-start gap-3 text-[15px] text-ink">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={b2b} onChange={(e) => setB2b(e.target.checked)} />
          <span>
            Pohledávka mezi podnikateli – přičíst minimální náklady spojené s uplatněním pohledávky {MIN_RECOVERY_COSTS.toLocaleString("cs-CZ")} Kč (§ 3 nařízení vlády
            č. 351/2013 Sb.)
          </span>
        </label>
        <p className="text-sm text-muted">Nic neukládáme ani neodesíláme – počítá se jen ve vašem prohlížeči.</p>
      </form>

      <div aria-live="polite" className="space-y-4">
        {amount.trim() !== "" && (n === null || n <= 0) && (
          <p role="alert" className="rounded-2xl bg-danger-50 p-5 text-danger-600">
            Zadejte dlužnou částku kladným číslem, například 25 000.
          </p>
        )}
        {!r && !(amount.trim() !== "" && (n === null || n <= 0)) && (
          <div className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">Zadejte částku, den splatnosti a den zaplacení.</div>
        )}
        {r && !r.ok && (
          <div role="alert" className="rounded-2xl border-2 border-line bg-surface p-6 text-ink">
            {r.error === "no-delay" && "Dlužník zaplatil nejpozději v den splatnosti – v prodlení není a úrok z prodlení nevzniká."}
            {r.error === "input" && "Zkontrolujte částku a obě data."}
            {r.error === "before-2014" &&
              "Prodlení začalo před 1. 1. 2014. Tehdy platila jiná pravidla (nařízení vlády č. 142/1994 Sb.) – tato kalkulačka je neřeší."}
            {r.error === "not-verified" &&
              `Sazbu pro ${r.halfYear ? halfYearLabel(r.halfYear) : "toto pololetí"} určí repo sazba ČNB platná k jeho prvnímu dni. Tabulku sazeb jsme naposledy ověřili ${formatCzDate(CNB_REPO_VERIFIED_AT)}, pro toto pololetí ji zatím nemáme.`}
          </div>
        )}
        {r && r.ok && n !== null && (
          <div className="space-y-4 rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Úrok z prodlení</p>
            <p className="text-3xl font-extrabold tabular-nums text-ink">{formatCzk(r.interest)}</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-[15px] tabular-nums">
              <dt className="text-ink-soft">První den prodlení</dt>
              <dd className="text-right font-semibold text-ink">{formatCzDate(r.firstDay)}</dd>
              <dt className="text-ink-soft">Dní prodlení</dt>
              <dd className="text-right font-semibold text-ink">{dny(r.days)}</dd>
              <dt className="text-ink-soft">
                Repo sazba ČNB k {formatCzDate(r.halfYear)} ({halfYearLabel(r.halfYear)})
              </dt>
              <dd className="text-right font-semibold text-ink">{pct(r.repo)}</dd>
              <dt className="text-ink-soft">Sazba úroku z prodlení (repo + {LATE_INTEREST_MARGIN} p. b.)</dt>
              <dd className="text-right font-semibold text-ink">{pct(r.rate)} ročně</dd>
              <dt className="text-ink-soft">Úrok za 1 den</dt>
              <dd className="text-right font-semibold text-ink">{formatCzk(r.perDay)}</dd>
              {b2b && (
                <>
                  <dt className="text-ink-soft">Minimální náklady uplatnění pohledávky</dt>
                  <dd className="text-right font-semibold text-ink">{formatCzk(MIN_RECOVERY_COSTS)}</dd>
                </>
              )}
              <dt className="border-t border-line pt-2 font-semibold text-ink">Dluh celkem s úrokem{b2b ? " a náklady" : ""}</dt>
              <dd className="border-t border-line pt-2 text-right text-xl font-extrabold text-ink">
                {formatCzk(Math.round((n + r.interest + (b2b ? MIN_RECOVERY_COSTS : 0)) * 100) / 100)}
              </dd>
            </dl>
            <p className="text-sm text-ink-soft">
              Úrok = {formatCzk(n)} × {pct(r.rate)} × {r.days} / 365. Sazba se řídí pololetím, ve kterém prodlení začalo, a do zaplacení se nemění.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
