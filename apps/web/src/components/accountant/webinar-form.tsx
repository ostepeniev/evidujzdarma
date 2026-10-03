"use client";

import { useState } from "react";
import { INTEREST_NEXT } from "@/lib/interests";
import { SITE } from "@/lib/site";
import { WEBINAR_OPTIONS, type WebinarOption } from "./webinars";

type Campaign = WebinarOption["value"];

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string; field?: string }
  | { kind: "done"; campaign: Campaign };

/**
 * Přihláška na webinář „EET 2.0 pro účetní“ / zájem o Účetní kabinet. Používá POST /api/preregistrace s polem
 * interest (R7.4): nová adresa potvrdí e-mail, známá adresa dostane vlastní potvrzení zájmu. Odpověď je pro všechny stejná.
 */
export function WebinarForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const campaign = (fd.get("campaign") as Campaign | null) ?? "webinar";
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
          interest: campaign,
          utm: { utm_source: "ucetni" },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Něco se nepovedlo. Zkuste to prosím znovu.", field: data.field });
        return;
      }
      setState({ kind: "done", campaign });
    } catch {
      setState({ kind: "error", message: "Nepodařilo se odeslat. Zkontrolujte připojení a zkuste to znovu." });
    }
  }

  if (state.kind === "done") {
    return (
      <div role="status" className="space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-700" aria-hidden="true">
          ✓
        </div>
        {/* nová i už známá adresa dostane e-mail s odkazem k potvrzení – text platí pro obě (R7.4) */}
        <h3 className="text-xl font-bold text-ink">Zkontrolujte prosím e-mail</h3>
        <p className="text-ink-soft">Poslali jsme vám odkaz k potvrzení. {INTEREST_NEXT[state.campaign]}</p>
        <p className="text-sm text-muted">Pokud jste se dříve z našich e-mailů odhlásili, e-mail vám nepřijde – napište nám na {SITE.email}.</p>
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
        E-mail a IČO použijeme jen k přihlášení na webinář a k zaslání pozvánky. Podrobnosti najdete v{" "}
        <a href="/ochrana-osobnich-udaju" className="underline">
          zásadách ochrany osobních údajů
        </a>
        .
      </p>
    </form>
  );
}
