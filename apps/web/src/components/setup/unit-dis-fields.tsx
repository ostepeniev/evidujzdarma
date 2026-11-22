"use client";

import { ExternalLink } from "@/components/external-link";
import { SOURCES } from "@/content/facts";
import { DIS_UNIT_CODE, VEHICLE_TYPES } from "@/lib/dis-units-csv";

/**
 * S12 (22. 11. 2026): nepovinné údaje evidenční jednotky pro hromadný import do DIS+ (CSV podle GFŘ, 3. 11. 2026).
 * Pole se ukazují podle druhu jednotky: adresa / RÚIAN u stálé provozovny, automatu a podnikatele bez provozovny,
 * lokalizace u mobilní provozovny, webu a vozidla, druh vozidla jen u dopravního prostředku.
 */
export interface UnitDisDraft {
  czNace: string;
  ruianCode: string;
  locationText: string;
  vehicleType: string;
  vehicleNote: string;
  indirectRepresentation: boolean;
}

export function unitDisDraft(u: {
  czNace?: string | null;
  ruianCode?: string | null;
  locationText?: string | null;
  vehicleType?: string | null;
  vehicleNote?: string | null;
  indirectRepresentation?: boolean;
}): UnitDisDraft {
  return {
    czNace: u.czNace ?? "",
    ruianCode: u.ruianCode ?? "",
    locationText: u.locationText ?? "",
    vehicleType: u.vehicleType ?? "",
    vehicleNote: u.vehicleNote ?? "",
    indirectRepresentation: u.indirectRepresentation ?? false,
  };
}

/** Tělo PATCH /api/ucet/jednotky/[id] – prázdný text = null (server ho tak i ukládá). */
export function unitDisPatch(d: UnitDisDraft) {
  return {
    czNace: d.czNace.trim() || null,
    ruianCode: d.ruianCode.trim() || null,
    locationText: d.locationText.trim() || null,
    vehicleType: (d.vehicleType || null) as "A" | "N" | "B" | "M" | "V" | "T" | "P" | "L" | "J" | null,
    vehicleNote: d.vehicleNote.trim() || null,
    indirectRepresentation: d.indirectRepresentation,
  };
}

const LOCATION_HINT: Record<string, string> = {
  M: "Popis místa, kde prodáváte (např. tržiště na náměstí, festival).",
  I: "Adresa webu nebo aplikace (např. https://vas-eshop.cz).",
  D: "Registrační značka (SPZ) nebo jiný jednoznačný identifikátor.",
  A: "Popis umístění automatu, pokud nemá adresu.",
  S: "Nepovinné upřesnění adresy (např. 2. patro, vchod ze dvora).",
  P: "Nepovinné upřesnění adresy.",
};

export function UnitDisFields({ type, label, value, onChange }: { type: string; label: string; value: UnitDisDraft; onChange: (v: Partial<UnitDisDraft>) => void }) {
  const code = DIS_UNIT_CODE[type] ?? "S";
  const usesAddress = code === "S" || code === "A" || code === "P";
  return (
    <fieldset className="grid gap-2 rounded-xl border border-line p-3 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Údaje pro hromadný import do DIS+ (nepovinné)</legend>
      <label className="text-sm">
        <span className="font-medium">Převažující činnost – kód CZ-NACE</span>
        <input
          aria-label={`Kód CZ-NACE jednotky ${label}`}
          className="input mt-1"
          inputMode="numeric"
          maxLength={8}
          placeholder="jen číslice"
          value={value.czNace}
          onChange={(e) => onChange({ czNace: e.target.value.replace(/[^\d]/g, "").slice(0, 6) })}
        />
        <span className="mt-1 block text-xs text-muted">
          Kód z číselníku činností, který nabízí DIS+ (bez teček). Najdete ho v{" "}
          <ExternalLink href={SOURCES.czNace.url} className="underline">
            klasifikaci CZ-NACE na webu ČSÚ
          </ExternalLink>
          ; před importem ho porovnejte s nabídkou v DIS+.
        </span>
      </label>
      {usesAddress && (
        <label className="text-sm">
          <span className="font-medium">Kód adresního místa RÚIAN</span>
          <input
            aria-label={`Kód adresního místa RÚIAN jednotky ${label}`}
            className="input mt-1"
            inputMode="numeric"
            maxLength={9}
            placeholder="až 9 číslic"
            value={value.ruianCode}
            onChange={(e) => onChange({ ruianCode: e.target.value.replace(/[^\d]/g, "").slice(0, 9) })}
          />
          <span className="mt-1 block text-xs text-muted">
            DIS+ ho upřednostňuje před adresou. Vyhledáte ho podle adresy v{" "}
            <ExternalLink href={SOURCES.ruianAdresniMista.url} className="underline">
              RÚIAN (ČÚZK)
            </ExternalLink>
            . Bez kódu použijeme adresu ve tvaru „Ulice 12/3, 360 01 Obec“.
          </span>
        </label>
      )}
      <label className="text-sm sm:col-span-2">
        <span className="font-medium">{code === "M" || code === "I" || code === "D" ? "Lokalizace" : "Upřesnění umístění"}</span>
        <input
          aria-label={`Lokalizace jednotky ${label}`}
          className="input mt-1"
          maxLength={255}
          value={value.locationText}
          onChange={(e) => onChange({ locationText: e.target.value })}
        />
        <span className="mt-1 block text-xs text-muted">{LOCATION_HINT[code]}</span>
      </label>
      {code === "D" && (
        <>
          <label className="text-sm">
            <span className="font-medium">Druh dopravního prostředku</span>
            <select aria-label={`Druh dopravního prostředku jednotky ${label}`} className="input mt-1" value={value.vehicleType} onChange={(e) => onChange({ vehicleType: e.target.value })}>
              <option value="">Vyberte…</option>
              {Object.entries(VEHICLE_TYPES).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {value.vehicleType === "J" && (
            <label className="text-sm">
              <span className="font-medium">Upřesnění druhu</span>
              <input aria-label={`Upřesnění druhu dopravního prostředku jednotky ${label}`} className="input mt-1" maxLength={150} value={value.vehicleNote} onChange={(e) => onChange({ vehicleNote: e.target.value })} />
            </label>
          )}
        </>
      )}
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="mt-1" checked={value.indirectRepresentation} onChange={(e) => onChange({ indirectRepresentation: e.target.checked })} />
        <span>
          V této jednotce přijímám tržby vlastním jménem na účet jiného podnikatele (nepřímé zastoupení, například komisní prodej).
          Nevíte-li, nechte nezaškrtnuté a ověřte to s účetní.
        </span>
      </label>
    </fieldset>
  );
}
