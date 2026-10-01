"use client";

import { useState } from "react";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string; field?: string } | { kind: "done" };

/** Formulář námitky (čl. 21 GDPR) / žádosti o opravu údajů v katalogu. */
export function ObjectionForm({ defaultIco = "", defaultIcp = "" }: { defaultIco?: string; defaultIcp?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/namitka", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: fd.get("kind"),
          ico: fd.get("ico") || undefined,
          icp: fd.get("icp") || undefined,
          name: fd.get("name"),
          email: fd.get("email"),
          message: fd.get("message"),
          website: fd.get("website") ?? "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Odeslání se nepovedlo.", field: data.field });
        return;
      }
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error", message: "Nepodařilo se odeslat. Zkontrolujte připojení a zkuste to znovu." });
    }
  }

  if (state.kind === "done") {
    return (
      <div role="status" className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
        <h2 className="text-xl font-bold text-ink">Děkujeme, žádost jsme přijali</h2>
        <p className="mt-2 text-ink-soft">
          Stránku jsme do vyřízení vyřadili z indexace vyhledávačů. Odpovíme na uvedený e-mail nejpozději do 30 dnů.
        </p>
      </div>
    );
  }

  const err = state.kind === "error" ? state : null;
  const invalid = (f: string) => (err?.field === f ? true : undefined);

  return (
    <form onSubmit={onSubmit} className="card space-y-5" noValidate>
      <fieldset>
        <legend className="label">Typ žádosti</legend>
        <div className="flex flex-wrap gap-4 text-[15px]">
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="objection" defaultChecked /> Námitka proti zveřejnění (čl. 21 GDPR)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="correction" /> Oprava údajů
          </label>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ob-ico" className="label">
            IČO
          </label>
          <input id="ob-ico" name="ico" inputMode="numeric" maxLength={10} defaultValue={defaultIco} className="input" aria-invalid={invalid("ico")} />
        </div>
        <div>
          <label htmlFor="ob-icp" className="label">
            IČP provozovny (nepovinné)
          </label>
          <input id="ob-icp" name="icp" inputMode="numeric" maxLength={12} defaultValue={defaultIcp} className="input" aria-invalid={invalid("icp")} />
        </div>
      </div>
      <p className="-mt-3 text-sm text-muted">Vyplňte IČO nebo IČP.</p>

      <div>
        <label htmlFor="ob-name" className="label">
          Jméno a příjmení
        </label>
        <input id="ob-name" name="name" required maxLength={200} autoComplete="name" className="input" aria-invalid={invalid("name")} />
      </div>
      <div>
        <label htmlFor="ob-email" className="label">
          E-mail pro odpověď
        </label>
        <input id="ob-email" name="email" type="email" required maxLength={254} autoComplete="email" className="input" aria-invalid={invalid("email")} />
      </div>
      <div>
        <label htmlFor="ob-message" className="label">
          Zpráva
        </label>
        <textarea
          id="ob-message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          className="input"
          placeholder="Popište, které údaje jsou nesprávné, nebo důvody námitky vztahující se k vaší konkrétní situaci."
          aria-invalid={invalid("message")}
        />
      </div>

      {/* honeypot — skryté pro lidi */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="ob-website">Web</label>
        <input id="ob-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {err && (
        <p role="alert" className="rounded-xl bg-danger-50 p-4 text-danger-600">
          {err.message}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Odesílám…" : "Odeslat žádost"}
      </button>
      <p className="text-sm text-muted">Údaje z formuláře použijeme jen k vyřízení žádosti a komunikaci s vámi.</p>
    </form>
  );
}
