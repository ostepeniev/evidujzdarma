"use client";

import { useState } from "react";
import { analyzeDic, type DicError } from "@ez/cz/dic";
import { ExternalLink } from "@/components/external-link";
import { SOURCES } from "@/content/facts";

const ERRORS: Record<Exclude<DicError, "empty" | "foreign">, string> = {
  format: "České DIČ tvoří „CZ“ a 8, 9 nebo 10 číslic. Jiné znaky ani délka nesedí.",
  "ico-checksum": "Osm číslic za „CZ“ je IČO právnické osoby – ale kontrolní číslice IČO nesedí. Nejspíš jde o překlep.",
  "rc-date": "Číslice za „CZ“ neodpovídají rodnému číslu: datum narození v něm není platné.",
  "rc-checksum": "Desetimístné rodné číslo musí být dělitelné jedenácti beze zbytku (§ 13 zákona o evidenci obyvatel). Toto není.",
  "rc-9-digits": "Devítimístné rodné číslo mají jen lidé narození před 1. 1. 1954 – začátek čísla tomu neodpovídá.",
};

/** S2 B1: kontrola tvaru českého DIČ. DIČ fyzické osoby obvykle obsahuje rodné číslo, proto se nic nikam neodesílá. */
export function DicValidator() {
  const [value, setValue] = useState("");
  const r = analyzeDic(value);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form className="card space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="dic-v" className="label">
            DIČ
          </label>
          <input
            id="dic-v"
            className="input text-lg"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="např. CZ12345679"
            maxLength={20}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="mt-1 text-sm text-muted">S „CZ“ i bez něj, mezery nevadí.</p>
        </div>
        <p className="text-sm text-muted">
          DIČ nikam neodesíláme – kontrola běží jen ve vašem prohlížeči. Datum narození z rodného čísla nezobrazujeme.
        </p>
      </form>

      <div aria-live="polite" className="space-y-4">
        {!r.ok && r.error === "empty" && (
          <div className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">Zadejte DIČ a uvidíte, zda odpovídá zákonnému tvaru.</div>
        )}
        {!r.ok && r.error === "foreign" && (
          <div className="rounded-2xl border-2 border-line bg-surface p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Zahraniční DIČ ({r.country})</p>
            <p className="mt-2 text-ink-soft">
              Ověřujeme jen česká DIČ. Zahraniční DIČ (VAT ID) z jiné země EU ověříte v systému{" "}
              <ExternalLink href={SOURCES.vies.url} className="font-medium text-brand-700 underline underline-offset-4">
                VIES Evropské komise
              </ExternalLink>
              .
            </p>
          </div>
        )}
        {!r.ok && r.error !== "empty" && r.error !== "foreign" && (
          <div role="alert" className="rounded-2xl border-2 border-danger-600 bg-danger-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-danger-600">Tvar DIČ nesedí</p>
            {r.dic && <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{r.dic}</p>}
            <p className="mt-2 text-ink">{ERRORS[r.error]}</p>
          </div>
        )}
        {r.ok && (
          <div className={`rounded-2xl border-2 p-6 ${r.rcException ? "border-sun-500 bg-warn-50" : "border-brand-500 bg-brand-50"}`}>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">{r.rcException ? "Tvar DIČ – ověřte" : "Tvar DIČ je v pořádku"}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{r.dic}</p>
            <p className="mt-2 text-ink-soft">
              {r.kind === "legal" &&
                "Odpovídá DIČ právnické osoby: „CZ“ a IČO. Kontrolní číslice IČO sedí."}
              {r.kind === "natural" &&
                !r.rcException &&
                "Odpovídá DIČ fyzické osoby: „CZ“ a rodné číslo. Datum i dělitelnost jedenácti sedí."}
              {r.kind === "natural" &&
                r.rcException &&
                "Číslo za „CZ“ nesplňuje dělitelnost jedenácti. Odpovídá ale starší výjimce: u části rodných čísel přidělených před rokem 1986 vychází zbytek prvních devíti číslic 10 a poslední číslice je 0. Ověřte DIČ v registru plátců DPH."}
              {r.kind === "vcp" &&
                "Odpovídá DIČ s vlastním identifikátorem správce daně (VČP): devět číslic, první je 6. Kontrolní číslici VČP neověříme – Finanční správa její výpočet nezveřejňuje."}
            </p>
            {r.kind === "legal" && (
              <a href={`/kontrola-ico#ico=${r.dic.slice(2)}`} className="btn-primary mt-4">
                Týká se firmy EET 2.0?
              </a>
            )}
          </div>
        )}
        <div className="card text-[15px] text-ink-soft">
          <p>
            <strong className="text-ink">Tvar ještě neznamená registraci.</strong> Zda je subjekt plátcem DPH, zda není nespolehlivým plátcem a jaké
            účty zveřejnil, ověříte v{" "}
            <ExternalLink href={SOURCES.registrDph.url} className="font-medium text-brand-700 underline underline-offset-4">
              Registru DPH Finanční správy
            </ExternalLink>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
