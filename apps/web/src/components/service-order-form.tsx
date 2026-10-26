"use client";

import { useState } from "react";
import { SETUP_SERVICE } from "@/content/services";
import { clarityEvent } from "@/lib/clarity-event";
import { SITE } from "@/lib/site";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string; field?: string } | { kind: "done" };

/** S5-SLUŽBY: poptávka „Nastavení EET na klíč“ – bez telefonu, odpověď e-mailem (rozhodnutí majitele 26. 10. 2026). */
export function ServiceOrderForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/poptavka", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email"),
          ico: fd.get("ico") || undefined,
          establishments: fd.get("establishments") || undefined,
          message: fd.get("message") || undefined,
          website: fd.get("website") ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Něco se nepovedlo.", field: data.field });
        return;
      }
      setState({ kind: "done" });
      clarityEvent("service_order");
    } catch {
      setState({ kind: "error", message: `Nepodařilo se odeslat. Zkuste to znovu, nebo napište na ${SITE.email}.` });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="space-y-4 text-center" role="status" data-service-order="done">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-700">✓</div>
        <h3 className="text-2xl font-bold text-ink">Díky, poptávku máme</h3>
        <p className="text-ink-soft">{SETUP_SERVICE.responseTime} Odpověď přijde z adresy {SITE.email} – podívejte se případně i do hromadné pošty.</p>
      </div>
    );
  }

  const err = state.kind === "error" ? state : null;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate data-service-order="form">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="so-email" className="label">
            E-mail <span className="text-danger-600">*</span>
          </label>
          <input id="so-email" name="email" type="email" required autoComplete="email" className="input" placeholder="vas@email.cz" aria-invalid={err?.field === "email"} />
        </div>
        <div>
          <label htmlFor="so-ico" className="label">
            IČO <span className="font-normal text-muted">(nepovinné)</span>
          </label>
          <input id="so-ico" name="ico" inputMode="numeric" className="input" placeholder="8 číslic" aria-invalid={err?.field === "ico"} />
        </div>
        <div>
          <label htmlFor="so-est" className="label">
            Počet provozoven <span className="font-normal text-muted">(nepovinné)</span>
          </label>
          <select id="so-est" name="establishments" className="input" defaultValue="">
            <option value="">Vyberte…</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4 a více</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="so-msg" className="label">
            Co už máte hotové a s čím pomoct? <span className="font-normal text-muted">(nepovinné)</span>
          </label>
          <textarea
            id="so-msg"
            name="message"
            rows={4}
            maxLength={2000}
            className="input"
            placeholder="Např.: kadeřnictví, jedna provozovna, do DIS+ jsem se ještě nepřihlásila."
            aria-invalid={err?.field === "message"}
          />
        </div>
      </div>

      {/* honeypot */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {err && (
        <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-[15px] text-danger-600">
          {err.message}
        </p>
      )}

      <button type="submit" disabled={state.kind === "sending"} className="btn-primary w-full py-4 text-lg">
        {state.kind === "sending" ? "Odesílám…" : `Poptat nastavení za ${SETUP_SERVICE.priceLabel}`}
      </button>
      <p className="text-xs leading-relaxed text-muted">
        Odesláním nic neplatíte ani se k ničemu nezavazujete. {SETUP_SERVICE.payment} Údaje použijeme jen k vyřízení poptávky – více v{" "}
        <a href="/ochrana-osobnich-udaju#ucely" className="underline">
          zásadách ochrany osobních údajů
        </a>
        .
      </p>
    </form>
  );
}
