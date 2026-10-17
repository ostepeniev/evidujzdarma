"use client";

import Link from "next/link";
import { useState } from "react";
import { accountToIban, checkIban } from "@/lib/validators";
import { CopyValue } from "./copy-value";

const ACCOUNT_ERRORS = {
  format: "Zadejte účet ve tvaru předčíslí-číslo/kód banky, například 19-2000145399/0800. Předčíslí je nepovinné, kód banky má 4 číslice.",
  zeros: "Číslo účtu nemůže být nulové.",
  prefix: "Předčíslí nesplňuje kontrolu podle vyhlášky č. 169/2011 Sb. – zkontrolujte, zda v něm není překlep.",
  number: "Číslo účtu nesplňuje kontrolu podle vyhlášky č. 169/2011 Sb. – zkontrolujte, zda v něm není překlep.",
} as const;

const IBAN_ERRORS = {
  format: "Český IBAN začíná CZ a má 24 znaků, například CZ65 0800 0000 1920 0014 5399.",
  "cz-length": "Český IBAN má vždy 24 znaků.",
  checksum: "Kontrolní číslice IBAN nesedí (modulo 97). Nejspíš je v něm překlep.",
} as const;

type Mode = "to-iban" | "to-account";

/** S2 B1: tuzemský účet → IBAN a zpět. Vše v prohlížeči. */
export function AccountIbanConverter() {
  const [mode, setMode] = useState<Mode>("to-iban");
  const [account, setAccount] = useState("");
  const [iban, setIban] = useState("");
  const a = accountToIban(account);
  const b = checkIban(iban);
  const foreign = b.ok && b.country !== "CZ";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form className="card space-y-5" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend className="label">Co chcete převést</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["to-iban", "Číslo účtu → IBAN"],
                ["to-account", "IBAN → číslo účtu"],
              ] as [Mode, string][]
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={mode === v}
                onClick={() => setMode(v)}
                className={`rounded-full border px-4 py-2 text-[15px] font-medium ${mode === v ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-surface"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </fieldset>
        {mode === "to-iban" ? (
          <div>
            <label htmlFor="acc-in" className="label">
              Číslo účtu
            </label>
            <input
              id="acc-in"
              className="input font-mono text-lg"
              autoComplete="off"
              inputMode="text"
              placeholder="např. 19-2000145399/0800"
              maxLength={30}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            />
            <p className="mt-1 text-sm text-muted">Předčíslí (nepovinné) - číslo účtu / kód banky.</p>
          </div>
        ) : (
          <div>
            <label htmlFor="iban-in" className="label">
              IBAN
            </label>
            <input
              id="iban-in"
              className="input font-mono text-lg"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="např. CZ65 0800 0000 1920 0014 5399"
              maxLength={50}
              value={iban}
              onChange={(e) => setIban(e.target.value)}
            />
          </div>
        )}
        <p className="text-sm text-muted">Číslo účtu nikam neodesíláme – převod běží jen ve vašem prohlížeči.</p>
      </form>

      <div aria-live="polite" className="space-y-4">
        {mode === "to-iban" &&
          (a.ok ? (
            <div className="space-y-4 rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">IBAN k účtu {a.formattedAccount}</p>
              <CopyValue label="Písemná podoba (s mezerami)" value={a.formatted} />
              <CopyValue label="Elektronická podoba (bez mezer)" value={a.iban} />
              <p className="text-ink-soft">
                Banka:{" "}
                {a.bank ? (
                  <>
                    <strong className="text-ink">{a.bank.name}</strong>
                    {a.bank.bic ? ` (BIC ${a.bank.bic})` : ""}
                  </>
                ) : (
                  <>kód {a.account.bankCode} v aktuálním číselníku ČNB není – zkontrolujte ho.</>
                )}
              </p>
              <Link href="/qr-platba" className="btn-secondary">
                Vytvořit QR platbu
              </Link>
            </div>
          ) : a.error === "empty" ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">Zadejte číslo účtu a IBAN se objeví hned.</div>
          ) : (
            <div role="alert" className="rounded-2xl border-2 border-danger-600 bg-danger-50 p-6 text-ink">
              {ACCOUNT_ERRORS[a.error]}
            </div>
          ))}
        {mode === "to-account" &&
          (b.ok && b.cz ? (
            <div className={`space-y-4 rounded-2xl border-2 p-6 ${b.cz.partsOk ? "border-brand-500 bg-brand-50" : "border-sun-500 bg-warn-50"}`}>
              <CopyValue label="Tuzemské číslo účtu" value={b.cz.account} />
              <p className="text-ink-soft">
                Banka:{" "}
                {b.cz.bank ? <strong className="text-ink">{b.cz.bank.name}</strong> : <>kód {b.cz.bankCode} v aktuálním číselníku ČNB není.</>}
              </p>
              {!b.cz.partsOk && (
                <p className="text-ink">
                  Kontrolní číslice IBAN sedí, ale číslo účtu uvnitř nesplňuje kontrolu podle vyhlášky č. 169/2011 Sb. Ověřte ho u příjemce.
                </p>
              )}
            </div>
          ) : foreign ? (
            <div className="rounded-2xl border-2 border-line bg-surface p-6 text-ink-soft">
              Zahraniční IBAN je platný, na české číslo účtu ho ale převést nejde. Ověříte ho v nástroji{" "}
              <Link href="/nastroje/overeni-iban" className="font-medium text-brand-700 underline underline-offset-4">
                Ověření IBAN
              </Link>
              .
            </div>
          ) : !b.ok && b.error === "empty" ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">Vložte český IBAN a uvidíte tuzemské číslo účtu.</div>
          ) : !b.ok && b.error !== "empty" ? (
            <div role="alert" className="rounded-2xl border-2 border-danger-600 bg-danger-50 p-6 text-ink">
              {IBAN_ERRORS[b.error]}
            </div>
          ) : null)}
      </div>
    </div>
  );
}
