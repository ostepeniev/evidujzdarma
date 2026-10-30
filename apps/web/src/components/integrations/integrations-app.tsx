"use client";

import { useState } from "react";
import { call } from "@/components/setup/api";
import { SITE } from "@/lib/site";

/**
 * Obrazovka „Integrace“ (S8, rozd. 7): propojení s rezervačním systémem, PMS nebo fakturací přes EET API.
 * Texty doslovně podle zadání. Token se zobrazí jen jednou, po vytvoření.
 */

export interface IntegrationItem {
  id: string;
  name: string;
  environment: "test" | "live";
  unitIds: string[];
  scopes: string[];
  tokenPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface IntegrationsState {
  integrations: IntegrationItem[];
  units: { id: string; label: string }[];
  liveAllowed: boolean;
  liveHint: string | null;
}

export const SUBTITLE = "Propojte EvidujZdarma s rezervačním systémem, hotelovým PMS nebo fakturací. Tržby z nich se evidují stejně jako z pokladny.";
export const TOKEN_ONCE = "Token se zobrazí jen jednou. Uložte ho do systému, který propojujete. Kdo token zná, může jménem vaší firmy evidovat tržby.";
export const REVOKE_CONFIRM = "Integrace přestane fungovat okamžitě. Tržby, které už přijala, se do EET odešlou.";
export const LIVE_HINT = "Ostré prostředí zapnete, až budete mít produkční certifikát.";

export const SCOPES: { id: string; label: string; hint?: string }[] = [
  { id: "sales:write", label: "Odesílat tržby" },
  { id: "sales:read", label: "Číst stav tržeb" },
  { id: "refunds:write", label: "Vracet tržby (bez PINu vlastníka)", hint: "Systém bude moct vracet peníze za tržby, které sám poslal, bez vašeho PINu." },
  { id: "units:read", label: "Číst jednotky" },
  { id: "closings:read", label: "Číst denní přehledy" },
  { id: "webhooks:manage", label: "Spravovat webhooky" },
];

const ENV_LABEL = { test: "Testovací (Playground)", live: "Ostré (produkce)" } as const;

const dateTime = (iso: string) => new Date(iso).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function TokenOnce({ token, onDone }: { token: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card mt-6 space-y-4 p-5" role="status">
      <p className="font-semibold">{TOKEN_ONCE}</p>
      <code className="block break-all rounded-xl bg-surface p-3 font-mono text-sm" data-testid="integration-token">
        {token}
      </code>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(token).then(() => setCopied(true));
          }}
        >
          {copied ? "Zkopírováno" : "Zkopírovat"}
        </button>
        <button type="button" className="btn-primary" onClick={onDone}>
          Hotovo
        </button>
      </div>
    </div>
  );
}

export function IntegrationRow({ item, units, onChanged }: { item: IntegrationItem; units: IntegrationsState["units"]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<{ requests: { at: string; method: string; route: string; status: number; errorCode: string | null }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unitNames = item.unitIds.map((id) => units.find((u) => u.id === id)?.label ?? "—").join(", ") || "žádná";
  async function revoke() {
    if (!window.confirm(REVOKE_CONFIRM)) return;
    setBusy(true);
    try {
      await call(`/api/ucet/integrace/${item.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodařilo se odpojit.");
    } finally {
      setBusy(false);
    }
  }
  async function toggle() {
    setOpen(!open);
    if (!open && !detail) {
      try {
        setDetail(await call(`/api/ucet/integrace/${item.id}`));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nepodařilo se načíst.");
      }
    }
  }
  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {item.name}
            {item.revokedAt && <span className="ml-2 rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-muted">Odpojeno</span>}
          </p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm text-ink-soft">
            <dt>Prostředí</dt>
            <dd>{ENV_LABEL[item.environment]}</dd>
            <dt>Jednotky</dt>
            <dd className="break-words">{unitNames}</dd>
            <dt>Naposledy použito</dt>
            <dd>{item.lastUsedAt ? dateTime(item.lastUsedAt) : "zatím ne"}</dd>
            <dt>Token</dt>
            <dd className="font-mono">{item.tokenPrefix}…</dd>
          </dl>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn-secondary py-1.5 text-sm" onClick={() => void toggle()} aria-expanded={open}>
            Poslední požadavky
          </button>
          {!item.revokedAt && (
            <button type="button" className="btn-secondary py-1.5 text-sm text-danger-600" onClick={() => void revoke()} disabled={busy}>
              Odpojit
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-600">
          {error}
        </p>
      )}
      {open && detail && (
        <div className="mt-3 overflow-x-auto">
          {detail.requests.length ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="py-1 pr-3 font-medium">Čas</th>
                  <th className="py-1 pr-3 font-medium">Požadavek</th>
                  <th className="py-1 pr-3 font-medium">Stav</th>
                  <th className="py-1 font-medium">Kód chyby</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detail.requests.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-3 whitespace-nowrap">{dateTime(r.at)}</td>
                    <td className="py-1 pr-3 font-mono">
                      {r.method} {r.route}
                    </td>
                    <td className="py-1 pr-3">{r.status}</td>
                    <td className="py-1 font-mono">{r.errorCode ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">Zatím žádné požadavky.</p>
          )}
        </div>
      )}
    </li>
  );
}

function NewIntegrationForm({ state, onCreated, onCancel }: { state: IntegrationsState; onCreated: (token: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [unitIds, setUnitIds] = useState<string[]>(state.units.length === 1 ? [state.units[0]!.id] : []);
  const [scopes, setScopes] = useState<string[]>(["sales:write", "sales:read", "units:read"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await call<{ token: string }>("/api/ucet/integrace", { method: "POST", json: { name, environment, unitIds, scopes } });
      onCreated(r.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Integraci se nepodařilo vytvořit.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card mt-6 space-y-5 p-5" onSubmit={(e) => void submit(e)}>
      <h2 className="text-xl font-bold">Nová integrace</h2>
      <div>
        <label htmlFor="int-name" className="label">
          Název
        </label>
        <input id="int-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="např. ALiSiO" maxLength={60} required />
      </div>
      <fieldset>
        <legend className="label">Prostředí</legend>
        <label className="flex items-center gap-2 py-1">
          <input type="radio" name="environment" value="test" checked={environment === "test"} onChange={() => setEnvironment("test")} />
          {ENV_LABEL.test}
        </label>
        <label className={`flex items-center gap-2 py-1 ${state.liveAllowed ? "" : "text-muted"}`}>
          <input type="radio" name="environment" value="live" checked={environment === "live"} onChange={() => setEnvironment("live")} disabled={!state.liveAllowed} />
          {ENV_LABEL.live}
        </label>
        {!state.liveAllowed && <p className="mt-1 text-sm text-muted">{state.liveHint ?? LIVE_HINT}</p>}
      </fieldset>
      <fieldset>
        <legend className="label">Evidenční jednotky</legend>
        {state.units.length ? (
          state.units.map((u) => (
            <label key={u.id} className="flex items-center gap-2 py-1">
              <input type="checkbox" checked={unitIds.includes(u.id)} onChange={() => setUnitIds(toggle(unitIds, u.id))} />
              {u.label}
            </label>
          ))
        ) : (
          <p className="text-sm text-muted">Nejdřív přidejte evidenční jednotku v nastavení pokladny.</p>
        )}
      </fieldset>
      <fieldset>
        <legend className="label">Oprávnění</legend>
        {SCOPES.map((s) => (
          <label key={s.id} className="flex items-start gap-2 py-1">
            <input type="checkbox" className="mt-1" checked={scopes.includes(s.id)} onChange={() => setScopes(toggle(scopes, s.id))} />
            <span>
              {s.label}
              {s.hint && <span className="block text-sm text-muted">{s.hint}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={busy || !name.trim() || !scopes.length}>
          Vytvořit integraci
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Zrušit
        </button>
      </div>
    </form>
  );
}

export function IntegrationsApp({ initial, openForm = false }: { initial: IntegrationsState; openForm?: boolean }) {
  const [state, setState] = useState(initial);
  const [form, setForm] = useState(openForm);
  const [token, setToken] = useState<string | null>(null);
  async function reload() {
    setState(await call<IntegrationsState>("/api/ucet/integrace"));
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold">Integrace</h1>
      <p className="mt-2 text-ink-soft">{SUBTITLE}</p>
      {!form && !token && (
        <button type="button" className="btn-primary mt-6" onClick={() => setForm(true)}>
          Nová integrace
        </button>
      )}
      {form && !token && (
        <NewIntegrationForm
          state={state}
          onCancel={() => setForm(false)}
          onCreated={(t) => {
            setToken(t);
            setForm(false);
            void reload();
          }}
        />
      )}
      {token && <TokenOnce token={token} onDone={() => setToken(null)} />}
      {state.integrations.length > 0 && (
        <ul className="mt-8 space-y-3">
          {state.integrations.map((i) => (
            <IntegrationRow key={i.id} item={i} units={state.units} onChanged={() => void reload()} />
          ))}
        </ul>
      )}
      <p className="mt-10 text-sm text-muted">
        Dokumentace pro vývojáře:{" "}
        <a href="/api-docs" className="text-brand-700 underline underline-offset-4">
          EET API
        </a>
        .
      </p>
      <p className="mt-3 text-xs text-muted">{SITE.independenceNotice}</p>
    </main>
  );
}
