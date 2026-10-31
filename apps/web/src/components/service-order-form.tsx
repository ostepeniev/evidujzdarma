"use client";

import { useEffect, useState } from "react";
import { SERVICE_PACKAGES, SETUP_SERVICE, type ServicePackageId } from "@/content/services";
import { clarityEvent } from "@/lib/clarity-event";
import { SITE } from "@/lib/site";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string; field?: string } | { kind: "done" };

/**
 * S5-SLUŽBY: poptávka „Nastavení EET na klíč“ – bez telefonu, odpověď e-mailem (rozhodnutí majitele 26. 10. 2026).
 * К13 (31. 10. 2026): volba balíčku (Nastavení na klíč / Připojení stávající pokladny) a nepovinný popis současné pokladny.
 * Odkaz „?balicek=pripojeni#poptavka“ předvybere připojení.
 */
export function ServiceOrderForm() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pkg, setPkg] = useState<ServicePackageId>(SETUP_SERVICE.id);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("balicek");
    const match = SERVICE_PACKAGES.find((p) => p.id === wanted);
    if (match) setPkg(match.id);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/poptavka", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          package: pkg,
          email: fd.get("email"),
          ico: fd.get("ico") || undefined,
          establishments: fd.get("establishments") || undefined,
          currentPos: fd.get("currentPos") || undefined,
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
      <fieldset>
        <legend className="label">
          Co poptáváte? <span className="text-danger-600">*</span>
        </legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {SERVICE_PACKAGES.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${pkg === p.id ? "border-brand-500 bg-brand-50" : "border-line bg-white"}`}
            >
              <input type="radio" name="package" value={p.id} checked={pkg === p.id} onChange={() => setPkg(p.id)} className="mt-1" />
              <span>
                <span className="block font-semibold text-ink">{p.name}</span>
                <span className="block text-sm text-ink-soft">{p.priceLabel}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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
          <label htmlFor="so-pos" className="label">
            Jakou pokladnu máte teď? <span className="font-normal text-muted">(nepovinné)</span>
          </label>
          <input
            id="so-pos"
            name="currentPos"
            maxLength={200}
            className="input"
            placeholder={pkg === "pripojeni" ? "Značka nebo systém, např. pokladna z EET 1.0 s tiskárnou" : "Např.: zatím žádnou"}
            aria-invalid={err?.field === "currentPos"}
          />
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
        {state.kind === "sending" ? "Odesílám…" : pkg === SETUP_SERVICE.id ? `Poptat nastavení za ${SETUP_SERVICE.priceExVatLabel}` : "Poptat připojení pokladny"}
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
