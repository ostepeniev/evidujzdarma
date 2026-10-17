"use client";

import Link from "next/link";
import { useState } from "react";
import { checkIban } from "@/lib/validators";
import { CopyValue } from "./copy-value";

const ERRORS = {
  format: "IBAN začíná dvěma písmeny kódu země a dvěma kontrolními číslicemi, pak následuje číslo účtu (celkem 15 až 34 znaků).",
  "cz-length": "Český IBAN má vždy 24 znaků: CZ, 2 kontrolní číslice, 4 číslice kódu banky a 16 číslic účtu.",
  checksum: "Kontrolní číslice nesedí (výpočet modulo 97). V IBAN je nejspíš překlep nebo přehozené číslice.",
} as const;

/** S2 B1: ověření IBAN libovolné země (ISO 13616, modulo 97); u českého IBAN i tuzemský účet a banka. */
export function IbanValidator() {
  const [value, setValue] = useState("");
  const r = checkIban(value);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form className="card space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="iban-v" className="label">
            IBAN
          </label>
          <input
            id="iban-v"
            className="input font-mono text-lg"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="např. CZ65 0800 0000 1920 0014 5399"
            maxLength={50}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="mt-1 text-sm text-muted">Mezery a malá písmena nevadí. Ověříme IBAN z jakékoli země.</p>
        </div>
        <p className="text-sm text-muted">IBAN nikam neodesíláme – kontrola běží jen ve vašem prohlížeči.</p>
      </form>

      <div aria-live="polite" className="space-y-4">
        {!r.ok && r.error === "empty" && (
          <div className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">Vložte IBAN a hned uvidíte, zda je platný.</div>
        )}
        {!r.ok && r.error !== "empty" && (
          <div role="alert" className="rounded-2xl border-2 border-danger-600 bg-danger-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-danger-600">IBAN není platný</p>
            <p className="mt-2 text-ink">{ERRORS[r.error]}</p>
          </div>
        )}
        {r.ok && (
          <div className={`space-y-4 rounded-2xl border-2 p-6 ${r.cz && !r.cz.partsOk ? "border-sun-500 bg-warn-50" : "border-brand-500 bg-brand-50"}`}>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              {r.cz && !r.cz.partsOk ? "Kontrolní číslice IBAN sedí, číslo účtu ne" : "IBAN je platný"}
            </p>
            <CopyValue label="Písemná podoba (s mezerami)" value={r.formatted} />
            <CopyValue label="Elektronická podoba (bez mezer)" value={r.iban} />
            <p className="text-ink-soft">
              Země: <strong className="text-ink">{r.country}</strong>
            </p>
            {r.cz && (
              <div className="space-y-2 border-t border-line pt-4 text-ink-soft">
                <p>
                  Tuzemský účet: <strong className="font-mono text-ink">{r.cz.account}</strong>
                </p>
                <p>
                  Banka:{" "}
                  {r.cz.bank ? (
                    <>
                      <strong className="text-ink">{r.cz.bank.name}</strong> (kód {r.cz.bankCode}
                      {r.cz.bank.bic ? `, BIC ${r.cz.bank.bic}` : ""})
                    </>
                  ) : (
                    <>kód {r.cz.bankCode} v aktuálním číselníku ČNB není – banku ověřte u příjemce.</>
                  )}
                </p>
                {!r.cz.partsOk && (
                  <p className="text-ink">
                    Předčíslí nebo číslo účtu uvnitř IBAN nesplňuje kontrolu podle vyhlášky č. 169/2011 Sb. Takový účet v české bance nejspíš
                    neexistuje – ověřte ho u příjemce.
                  </p>
                )}
              </div>
            )}
            {r.cz && r.cz.partsOk && (
              <Link href="/qr-platba" className="btn-secondary">
                Vytvořit QR platbu
              </Link>
            )}
          </div>
        )}
        <p className="text-sm text-muted">
          Platný IBAN znamená, že sedí kontrolní číslice. Komu účet patří, z IBAN nezjistíte. Zveřejněné účty plátců DPH najdete v registru DPH Finanční správy.
        </p>
      </div>
    </div>
  );
}
