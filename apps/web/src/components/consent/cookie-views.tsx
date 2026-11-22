import Link from "next/link";
import type { RefObject } from "react";
import type { ConsentCategory } from "@/lib/consent";

/**
 * S4-COOKIES: vzhled lišty a nastavení cookies – bez stavu (stav a značky drží consent-manager.tsx), aby šel testovat
 * vykreslením na serveru.
 *
 * Proč lišta dole a ne okno uprostřed (UX): okno uprostřed se ztmavením zakryje obsah, kvůli kterému člověk přišel,
 * a na telefonu často i tlačítko „zavřít“ – lidé pak odcházejí. Lišta dole nechá stránku číst i ovládat.
 *
 * S12 (22. 11. 2026, rozhodnutí majitele, DECISIONS К10.1): lišta je větší a výraznější, aby se návštěvník rozhodl
 * a lištu nepřehlížel – ale pořád to není „cookie zeď“: žádné ztmavení, stránka se dál posouvá a ovládá
 * (consent-manager.tsx pod lištu přidá místo, aby šel dočíst i konec stránky), nic není předem zaškrtnuté.
 *  - telefon (< 640 px): panel přes celou šířku, zhruba třetina výšky (min. 33vh, nejvýš 70vh, pak se posouvá uvnitř),
 *    nadpis 20 px, text 16 px, tlačítka ≥ 48 px v dosahu palce, místo pro gesto „domů“ (safe-area);
 *  - počítač: široký panel dole uprostřed (max. 960 px), nadpis 24 px, text 18 px, tlačítka 56 px;
 *  - „Odmítnout“ a „Souhlasím se vším“ mají stejnou velikost i styl (ÚOOÚ/EDPB: odmítnout musí jít stejně snadno jako
 *    souhlasit), „Nastavení“ je třetí, lehčí volba;
 *  - pozice fixed → žádný posun obsahu (CLS 0); jemné vyjetí, při „omezit pohyb“ bez animace (globals.css .ez-rise).
 */

export const BANNER_TITLE = "Souhlas s cookies";
export const BANNER_TEXT =
  "Rádi bychom měřili, které stránky vám pomáhají, a ukazovali naši reklamu jen lidem, kterým může pomoct. K tomu potřebujeme váš souhlas s cookies – změnit ho můžete kdykoli v patičce webu.";
/** S5 (26. 10. 2026): jen analytické značky (teď Microsoft Clarity) – lišta nesmí slibovat reklamu, kterou nemáme. */
export const BANNER_TEXT_ANALYTICS =
  "Rádi bychom měřili, které stránky vám pomáhají a co na webu zlepšit. K tomu potřebujeme váš souhlas s cookies – změnit ho můžete kdykoli v patičce webu.";
/** S12: popisky tlačítek první vrstvy (rozhodnutí majitele 22. 11. 2026). */
export const BANNER_ACCEPT_LABEL = "Souhlasím se vším";
export const BANNER_REJECT_LABEL = "Odmítnout";
export const BANNER_SETTINGS_LABEL = "Nastavení";

/** Stejná třída pro „Odmítnout“ i „Souhlasím se vším“ – stejná velikost, barva i váha písma. */
const DECISION_BTN = "btn-primary min-h-12 w-full px-3 py-3 text-base leading-tight sm:min-h-14 sm:px-6 sm:text-lg";

export function CookieBannerView({
  firstLayerReject,
  preview,
  marketing = true,
  onAccept,
  onSettings,
  onReject,
}: {
  firstLayerReject: boolean;
  preview?: boolean;
  /** je zapnutá aspoň jedna marketingová značka (nebo náhled) – jinak text bez reklamy */
  marketing?: boolean;
  onAccept?: () => void;
  onSettings?: () => void;
  onReject?: () => void;
}) {
  return (
    <section
      role="region"
      aria-labelledby="cookie-banner-h"
      aria-describedby="cookie-banner-text"
      data-cookie-banner="true"
      className="ez-rise no-print fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] min-h-[33vh] flex-col overflow-y-auto rounded-t-3xl border-t-4 border-brand-600 bg-white px-4 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.22)] sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:min-h-0 sm:max-w-[960px] sm:rounded-3xl sm:border-4 sm:px-10 sm:py-8"
    >
      {preview && <p className="chip mb-2 self-start bg-sun-100 text-warn-700">Náhled – nic se neukládá ani nenačítá</p>}
      <h2 id="cookie-banner-h" className="text-xl font-bold text-ink sm:text-2xl">
        {BANNER_TITLE}
      </h2>
      <p id="cookie-banner-text" className="mt-2 text-base leading-relaxed text-ink-soft sm:text-lg">
        {marketing || preview ? BANNER_TEXT : BANNER_TEXT_ANALYTICS}{" "}
        <Link href="/ochrana-osobnich-udaju#cookies" className="underline underline-offset-2">
          Více o cookies
        </Link>
      </p>
      <div className="mt-auto pt-4 sm:pt-6">
        {/* pořadí čtení i na obrazovce: Odmítnout, Souhlasím se vším (stejně velká a stejně výrazná), pak lehčí Nastavení */}
        <div className={`grid gap-3 ${firstLayerReject ? "grid-cols-2" : "grid-cols-1"} sm:gap-4`}>
          {firstLayerReject && (
            <button type="button" onClick={onReject} data-cookie-action="reject" className={DECISION_BTN}>
              {BANNER_REJECT_LABEL}
            </button>
          )}
          <button type="button" onClick={onAccept} data-cookie-action="accept" className={DECISION_BTN}>
            {BANNER_ACCEPT_LABEL}
          </button>
        </div>
        <button
          type="button"
          onClick={onSettings}
          data-cookie-action="settings"
          className="btn-ghost mt-2 min-h-11 w-full px-3 py-2 text-base underline underline-offset-4 sm:mt-3 sm:text-lg"
        >
          {BANNER_SETTINGS_LABEL}
        </button>
      </div>
    </section>
  );
}

export function CookieSwitch({ id, on, locked, onToggle }: { id: string; on: boolean; locked?: boolean; onToggle?: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={`cookie-cat-${id}`}
      disabled={locked}
      onClick={onToggle}
      data-cookie-switch={id}
      // ≥ 44 px zóna dotyku kolem malého přepínače
      className="-m-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-2 disabled:cursor-not-allowed"
    >
      <span className={`relative inline-block h-6 w-11 rounded-full transition-colors ${on ? "bg-brand-600" : "bg-line"} ${locked ? "opacity-60" : ""}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function CookieSettingsView({
  categories,
  values,
  preview,
  dialogRef,
  onToggle,
  onAcceptAll,
  onSave,
  onRejectAll,
  onClose,
}: {
  categories: readonly ConsentCategory[];
  values: { analytics: boolean; marketing: boolean };
  preview?: boolean;
  dialogRef?: RefObject<HTMLDivElement | null>;
  onToggle?: (id: "analytics" | "marketing") => void;
  onAcceptAll?: () => void;
  onSave?: () => void;
  onRejectAll?: () => void;
  onClose?: () => void;
}) {
  return (
    <div
      className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // klik vedle okna zavře bez změny (jako Esc)
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-h"
        tabIndex={-1}
        data-cookie-settings="true"
        // hlavička a tlačítka zůstanou vidět, posouvá se jen seznam kategorií
        className="ez-rise flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <h2 id="cookie-settings-h" className="text-xl font-bold text-ink">
            Nastavení cookies
          </h2>
          <button type="button" onClick={onClose} aria-label="Zavřít bez změny" className="-mr-2 -mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-2xl leading-none text-muted hover:bg-surface hover:text-ink">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
          {preview && <p className="chip mt-2 bg-sun-100 text-warn-700">Náhled – nic se neukládá ani nenačítá</p>}
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Vyberte, které cookies smíme používat. Volbu můžete kdykoli změnit tlačítkem „Nastavení cookies“ v patičce webu.
          </p>
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {categories.map((c) => {
              const on = c.locked ? true : c.id === "analytics" ? values.analytics : c.id === "marketing" ? values.marketing : false;
              return (
                <li key={c.id} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 id={`cookie-cat-${c.id}`} className="text-base font-semibold text-ink">
                      {c.title}
                    </h3>
                    {c.locked ? (
                      <span className="text-sm font-medium text-brand-700">Vždy zapnuté</span>
                    ) : (
                      <CookieSwitch id={c.id} on={on} onToggle={() => onToggle?.(c.id as "analytics" | "marketing")} />
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{c.text}</p>
                  <p className="mt-1 text-xs text-muted">Poskytovatelé: {c.vendors.join(", ")}</p>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted">
            Podrobnosti v{" "}
            <Link href="/ochrana-osobnich-udaju#cookies" className="underline underline-offset-2">
              zásadách ochrany osobních údajů
            </Link>
            .
          </p>
        </div>
        {/* S12 (22. 11. 2026): „Odmítnout vše“ stejně výrazné jako „Povolit vše“ (stejná třída), „Uložit výběr“ pod nimi */}
        <div className="grid grid-cols-2 gap-2 border-t border-line px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:gap-3 sm:px-6 sm:pb-6">
          <button type="button" onClick={onRejectAll} data-cookie-action="reject-all" className="btn-primary min-h-12 px-3 leading-tight">
            Odmítnout vše
          </button>
          <button type="button" onClick={onAcceptAll} data-cookie-action="accept-all" className="btn-primary min-h-12 px-3 leading-tight">
            Povolit vše
          </button>
          <button type="button" onClick={onSave} data-cookie-action="save" className="btn-secondary col-span-2 min-h-11">
            Uložit výběr
          </button>
        </div>
      </div>
    </div>
  );
}
