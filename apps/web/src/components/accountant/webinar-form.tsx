"use client";

import { useState } from "react";
import { SITE } from "@/lib/site";
import { WEBINAR_OPTIONS, type WebinarOption } from "./webinars";

type Campaign = WebinarOption["value"];

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string; field?: string }
  | { kind: "done"; duplicate: boolean; campaign: Campaign };

/**
 * Přihláška na webinář „EET 2.0 pro účetní“ / zájem o Účetní kabinet.
 * Používá POST /api/preregistrace — kampaň se rozliší přes utm (utm_source=ucetni).
 */
export function WebinarForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const campaign = (fd.get("campaign") as Campaign | null) ?? "webinar-2026-11-05";
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/preregistrace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email"),
          ico: fd.get("ico") || undefined,
          marketingConsent: fd.get("marketing") === "on",
          website: fd.get("website") ?? "",
          utm: { utm_source: "ucetni", utm_campaign: campaign },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; field?: string; duplicate?: boolean };
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Něco se nepovedlo. Zkuste to prosím znovu.", field: data.field });
        return;
      }
      setState({ kind: "done", duplicate: Boolean(data.duplicate), campaign });
    } catch {
      setState({ kind: "error", message: "Nepodařilo se odeslat. Zkontrolujte připojení a zkuste to znovu." });
    }
  }

  if (state.kind === "done") {
    const option = WEBINAR_OPTIONS.find((o) => o.value === state.campaign)!;
    return (
      <div role="status" className="space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-700" aria-hidden="true">
          ✓
        </div>
        {state.duplicate ? (
          <>
            <h3 className="text-xl font-bold text-ink">Tento e-mail už u nás máme</h3>
            <p className="text-ink-soft">
              Abychom vás na „{option.label}“ určitě zapsali, napište nám prosím krátce na{" "}
              <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(`Přihláška: ${option.label}`)}`} className="font-medium text-brand-700 underline">
                {SITE.email}
              </a>
              .
            </p>
          </>
        ) : (
          <>
            <h3 className="text-xl font-bold text-ink">Hotovo, jste přihlášeni</h3>
            <p className="text-ink-soft">
              Poslali jsme vám e-mail s odkazem pro potvrzení adresy.{" "}
              {state.campaign === "kabinet"
                ? "O spuštění Účetního kabinetu vám dáme vědět jako prvním."
                : "Přesný čas a odkaz na webinář vám pošleme e-mailem před termínem."}
            </p>
          </>
        )}
      </div>
    );
  }

  const err = state.kind === "error" ? state : null;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <fieldset className="space-y-2">
        <legend className="label">Na co se chcete přihlásit?</legend>
        {WEBINAR_OPTIONS.map((o, i) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
          >
            <input type="radio" name="campaign" value={o.value} defaultChecked={i === 0} className="mt-1 h-4 w-4 accent-brand-600" />
            <span>
              <span className="block font-semibold text-ink">{o.label}</span>
              <span className="block text-sm text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="wb-email" className="label">
            E-mail <span className="text-danger-600">*</span>
          </label>
          <input
            id="wb-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            placeholder="kancelar@email.cz"
            aria-invalid={err?.field === "email"}
          />
        </div>
        <div>
          <label htmlFor="wb-ico" className="label">
            IČO kanceláře <span className="font-normal text-muted">(nepovinné)</span>
          </label>
          <input id="wb-ico" name="ico" inputMode="numeric" className="input" placeholder="8 číslic" aria-invalid={err?.field === "ico"} />
        </div>
      </div>

      {/* honeypot */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-surface p-3 text-sm text-ink-soft">
        <input type="checkbox" name="marketing" className="mt-0.5 h-5 w-5 shrink-0 rounded accent-brand-600" />
        <span>
          Souhlasím se zasíláním novinek k EET a nabídek EvidujZdarma e-mailem. Souhlas můžete kdykoli odvolat odkazem v každém
          e-mailu. <span className="text-muted">(nepovinné)</span>
        </span>
      </label>

      {err && (
        <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-[15px] text-danger-600">
          {err.message}
        </p>
      )}

      <button type="submit" disabled={state.kind === "sending"} className="btn-primary w-full">
        {state.kind === "sending" ? "Odesílám…" : "Přihlásit se zdarma"}
      </button>
      <p className="text-xs leading-relaxed text-muted">
        Odesláním souhlasíte se zpracováním e-mailu a IČO za účelem přihlášky a zaslání pozvánky. Více v{" "}
        <a href="/ochrana-osobnich-udaju" className="underline">
          zásadách ochrany osobních údajů
        </a>
        .
      </p>
    </form>
  );
}
