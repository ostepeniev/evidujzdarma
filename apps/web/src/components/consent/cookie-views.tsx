import Link from "next/link";
import type { RefObject } from "react";
import type { ConsentCategory } from "@/lib/consent";

/**
 * S4-COOKIES: vzhled lišty a nastavení cookies – bez stavu (stav a značky drží consent-manager.tsx), aby šel testovat
 * vykreslením na serveru.
 *
 * Proč lišta dole a ne okno uprostřed (UX): okno uprostřed se ztmavením zakryje obsah, kvůli kterému člověk přišel,
 * a na telefonu často i tlačítko „zavřít“ – lidé pak odcházejí. Lišta dole nechá stránku číst i ovládat:
 *  - telefon (< 640 px): nízký list přes celou šířku, nejvýš ~40 % výšky, s místem pro gesto „domů“ (safe-area),
 *    tlačítka vedle sebe s výškou ≥ 44 px v dosahu palce; dočasně překryje připnuté tlačítko předregistrace (z-40);
 *  - počítač: malá karta vlevo dole (max. 420 px), nepřekryje navigaci ani formuláře uprostřed;
 *  - pozice fixed → žádný posun obsahu (CLS 0); jemné vyjetí, při „omezit pohyb“ bez animace (globals.css .ez-rise).
 */

export const BANNER_TITLE = "Souhlas s cookies";
export const BANNER_TEXT =
  "Rádi bychom měřili, které stránky vám pomáhají, a ukazovali naši reklamu jen lidem, kterým může pomoct. K tomu potřebujeme váš souhlas s cookies – změnit ho můžete kdykoli v patičce webu.";
/** S5 (26. 10. 2026): jen analytické značky (teď Microsoft Clarity) – lišta nesmí slibovat reklamu, kterou nemáme. */
export const BANNER_TEXT_ANALYTICS =
  "Rádi bychom měřili, které stránky vám pomáhají a co na webu zlepšit. K tomu potřebujeme váš souhlas s cookies – změnit ho můžete kdykoli v patičce webu.";

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
      aria-labelledby="cookie-banner-h"
      data-cookie-banner="true"
      className="ez-rise no-print fixed inset-x-0 bottom-0 z-50 max-h-[40vh] overflow-y-auto rounded-t-2xl border-t border-line bg-white px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-h-none sm:w-[420px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:border sm:p-5 sm:shadow-xl"
    >
      {preview && <p className="chip mb-2 bg-sun-100 text-warn-700">Náhled – nic se neukládá ani nenačítá</p>}
      <h2 id="cookie-banner-h" className="text-base font-bold text-ink">
        {BANNER_TITLE}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        {marketing || preview ? BANNER_TEXT : BANNER_TEXT_ANALYTICS}{" "}
        <Link href="/ochrana-osobnich-udaju#cookies" className="underline underline-offset-2">
          Více o cookies
        </Link>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {/* Souhlasím je v pořadí čtení první, na obrazovce vpravo (v dosahu palce) */}
        <button type="button" onClick={onAccept} data-cookie-action="accept" className="btn-primary order-2 min-h-11 px-3 py-2.5">
          Souhlasím
        </button>
        <button type="button" onClick={onSettings} data-cookie-action="settings" className="btn-secondary order-1 min-h-11 px-3 py-2.5">
          Nastavení
        </button>
      </div>
      {firstLayerReject && (
        <button type="button" onClick={onReject} data-cookie-action="reject" className="mt-1 min-h-11 w-full text-sm text-ink-soft underline underline-offset-2 hover:text-ink">
          Odmítnout
        </button>
      )}
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
        <div className="grid grid-cols-2 gap-2 border-t border-line px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
          <button type="button" onClick={onAcceptAll} className="btn-primary col-span-2 min-h-11">
            Povolit vše
          </button>
          <button type="button" onClick={onSave} className="btn-secondary min-h-11">
            Uložit výběr
          </button>
          <button type="button" onClick={onRejectAll} className="btn-secondary min-h-11">
            Odmítnout vše
          </button>
        </div>
      </div>
    </div>
  );
}
