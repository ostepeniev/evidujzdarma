"use client";

import { useState } from "react";
import { INDUSTRIES } from "@/content/industries";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string; field?: string }
  | { kind: "done" };

const NEEDS = [
  { value: "terminal", label: "Potřebuji platební terminál" },
  { value: "printer", label: "Potřebuji tiskárnu účtenek" },
  { value: "dis_help", label: "Potřebuji pomoc s DIS+ a certifikátem" },
] as const;

function readUtm(): Record<string, string> | undefined {
  const p = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = p.get(k);
    if (v) out[k] = v.slice(0, 100);
  }
  return Object.keys(out).length ? out : undefined;
}

export function PreregForm({ defaultIco = "" }: { defaultIco?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  /** Kód doporučení jen z adresy v okamžiku odeslání – do prohlížeče se neukládá (R7.10, Z6). */
  function refFromUrl(): string | undefined {
    const r = new URLSearchParams(window.location.search).get("ref");
    return r && /^[a-z0-9]{4,12}$/.test(r) ? r : undefined;
  }

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
          industry: fd.get("industry") || undefined,
          establishments: fd.get("establishments") || undefined,
          needs: fd.getAll("needs"),
          marketingConsent: fd.get("marketing") === "on",
          ref: refFromUrl(),
          website: fd.get("website") ?? "",
          utm: readUtm(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Něco se nepovedlo.", field: data.field });
        return;
      }
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error", message: "Nepodařilo se odeslat. Zkontrolujte připojení a zkuste to znovu." });
    }
  }

  if (state.kind === "done") return <Success />;

  const err = state.kind === "error" ? state : null;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="pr-email" className="label">
            E-mail <span className="text-danger-600">*</span>
          </label>
          <input
            id="pr-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            placeholder="vas@email.cz"
            aria-invalid={err?.field === "email"}
          />
        </div>
        <div>
          <label htmlFor="pr-ico" className="label">
            IČO <span className="font-normal text-muted">(nepovinné)</span>
          </label>
          <input
            id="pr-ico"
            name="ico"
            inputMode="numeric"
            defaultValue={defaultIco}
            className="input"
            placeholder="8 číslic"
            aria-invalid={err?.field === "ico"}
          />
        </div>
        <div>
          <label htmlFor="pr-est" className="label">
            Počet provozoven
          </label>
          <select id="pr-est" name="establishments" className="input" defaultValue="">
            <option value="">Vyberte…</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4 a více</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pr-ind" className="label">
            Obor
          </label>
          <select id="pr-ind" name="industry" className="input" defaultValue="">
            <option value="">Vyberte obor…</option>
            {INDUSTRIES.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">S čím chcete pomoct?</legend>
        {NEEDS.map((n) => (
          <label key={n.value} className="flex items-center gap-3 text-[15px] text-ink">
            <input type="checkbox" name="needs" value={n.value} className="h-5 w-5 rounded accent-brand-600" />
            {n.label}
          </label>
        ))}
      </fieldset>

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
          Souhlasím se zasíláním novinek k EET a nabídek EvidujZdarma e-mailem. Souhlas můžete kdykoli odvolat odkazem v
          každém e-mailu. <span className="text-muted">(nepovinné)</span>
        </span>
      </label>

      {err && (
        <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-[15px] text-danger-600">
          {err.message}
        </p>
      )}

      <button type="submit" disabled={state.kind === "sending"} className="btn-primary w-full py-4 text-lg">
        {state.kind === "sending" ? "Odesílám…" : "Chci EET pokladnu zdarma"}
      </button>
      <p className="text-xs leading-relaxed text-muted">
        E-mail a IČO použijeme k předregistraci a k zaslání vašeho EET plánu. Novinky posíláme jen se souhlasem výše a po potvrzení e-mailu. Více v{" "}
        <a href="/ochrana-osobnich-udaju" className="underline">
          zásadách ochrany osobních údajů
        </a>
        .
      </p>
    </form>
  );
}

function Success() {
  // odpověď serveru je stejná pro nový i už registrovaný e-mail (B Дрібне 11); pořadí a odkaz pro pozvání
  // ukáže stránka z potvrzovacího e-mailu
  return (
    <div className="space-y-5 text-center" role="status">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-700">✓</div>
      <h3 className="text-2xl font-bold text-ink">Hotovo! Zkontrolujte e-mail</h3>
      <p className="text-ink-soft">Poslali jsme vám EET plán a odkaz pro potvrzení e-mailu. Po potvrzení uvidíte své pořadí na včasný přístup a odkaz pro pozvání kolegů.</p>
      <p className="text-sm text-muted">Pokud už u nás tento e-mail máte, poslali jsme vám odkaz na vaši předregistraci.</p>
    </div>
  );
}
