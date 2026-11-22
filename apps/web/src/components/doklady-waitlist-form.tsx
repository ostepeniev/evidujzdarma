"use client";

import { useState } from "react";
import { INTEREST_NEXT } from "@/lib/interests";
import { SITE } from "@/lib/site";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string; field?: string } | { kind: "done" };

/**
 * S12 (22. 11. 2026): zájem o betu „Doklady k platbám“ (/ucetnictvi-bez-chaosu). Stejný mechanismus jako formulář pro
 * účetní (accountant/webinar-form.tsx): POST /api/preregistrace s polem interest = "doklady" (R7.4) – nová adresa potvrdí
 * e-mail (DOI), známá adresa dostane vlastní potvrzení zájmu, odpověď je pro všechny stejná. Souhlas s novinkami je
 * samostatné, nezaškrtnuté a nepovinné pole: bez něj žádost projde, ale marketingový souhlas se neuloží.
 */
export function DokladyWaitlistForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
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
          interest: "doklady",
          utm: { utm_source: "web", utm_medium: "pilir", utm_campaign: "doklady-k-platbam" },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Něco se nepovedlo. Zkuste to prosím znovu.", field: data.field });
        return;
      }
      setState({ kind: "done" });
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
        <h3 className="text-xl font-bold text-ink">Zkontrolujte prosím e-mail</h3>
        <p className="text-ink-soft">Poslali jsme vám e-mail s odkazem k potvrzení. {INTEREST_NEXT.doklady}</p>
        <p className="text-sm text-muted">Pokud jste dříve předregistraci zrušili, e-mail vám nepřijde – napište nám na {SITE.email}.</p>
      </div>
    );
  }

  const err = state.kind === "error" ? state : null;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate data-interest-form="doklady">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="dk-email" className="label">
            E-mail <span className="text-danger-600">*</span>
          </label>
          <input id="dk-email" name="email" type="email" required autoComplete="email" className="input" placeholder="vas@email.cz" aria-invalid={err?.field === "email"} />
        </div>
        <div>
          <label htmlFor="dk-ico" className="label">
            IČO <span className="font-normal text-muted">(nepovinné)</span>
          </label>
          <input id="dk-ico" name="ico" inputMode="numeric" className="input" placeholder="8 číslic" aria-invalid={err?.field === "ico"} />
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
          Souhlasím se zasíláním novinek k EET a nabídek EvidujZdarma e-mailem. Souhlas můžete kdykoli odvolat odkazem v každém e-mailu.{" "}
          <span className="text-muted">(nepovinné)</span>
        </span>
      </label>

      {err && (
        <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-[15px] text-danger-600">
          {err.message}
        </p>
      )}

      <button type="submit" disabled={state.kind === "sending"} className="btn-primary w-full">
        {state.kind === "sending" ? "Odesílám…" : "Chci betu vyzkoušet"}
      </button>
      <p className="text-xs leading-relaxed text-muted">
        E-mail a IČO použijeme k vyřízení vaší žádosti (pozvánka do bety Doklady k platbám); novinky vám pošleme, jen pokud zaškrtnete souhlas výše. Podrobnosti najdete v{" "}
        <a href="/ochrana-osobnich-udaju" className="underline">
          zásadách ochrany osobních údajů
        </a>
        .
      </p>
    </form>
  );
}
