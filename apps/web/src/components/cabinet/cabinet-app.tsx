"use client";

import Link from "next/link";
import { useState } from "react";
import { call } from "@/components/setup/api";

interface Readiness {
  disActivated: boolean;
  unitsAnnounced: boolean;
  certificate: boolean;
  firstSale: boolean;
  source: "pokladna" | "manual";
}
interface Client {
  id: string;
  ico: string;
  label: string | null;
  linked: boolean;
  invited: boolean;
  inviteUrl: string | null;
  readiness: Readiness;
  lastSaleAt: string | null;
  mode: string | null;
}
export interface CabinetState {
  user: { email: string };
  account: { id: string; name: string; ico: string | null } | null;
  clients: Client[];
}

const STEPS: { key: keyof Omit<Readiness, "source">; label: string }[] = [
  { key: "disActivated", label: "DIS+" },
  { key: "unitsAnnounced", label: "Jednotky" },
  { key: "certificate", label: "Certifikát" },
  { key: "firstSale", label: "1. tržba" },
];

function score(r: Readiness): number {
  return STEPS.filter((s) => r[s.key]).length;
}

export function CabinetApp({ initial }: { initial: CabinetState }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const reload = async () => setState(await call<CabinetState>("/api/kabinet"));
  const act = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Něco se nepovedlo");
    }
  };

  if (!state.account) return <CreateCabinet onCreated={reload} />;

  const clients = state.clients;
  const ready = clients.filter((c) => score(c.readiness) === 4).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Účetní kabinet · {state.user.email}</p>
          <h1 className="text-3xl font-extrabold">{state.account.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/ucetni/sablony" className="btn-secondary">
            Šablony dopisů
          </Link>
          <Link href="/ucetni/hromadna-kontrola" className="btn-secondary">
            Kontrola IČO
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-muted">Klientů</p>
          <p className="text-3xl font-extrabold">{clients.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Připravených na EET</p>
          <p className="text-3xl font-extrabold text-brand-700">{ready}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Propojených s pokladnou</p>
          <p className="text-3xl font-extrabold">{clients.filter((c) => c.linked).length}</p>
        </div>
      </div>

      <AddClients onAdded={async (msg) => (setInfo(msg), await reload())} />

      {error && (
        <p role="alert" className="rounded-xl bg-danger-50 p-3 text-danger-600">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="rounded-xl bg-brand-50 p-3 text-[15px]">
          {info}
        </p>
      )}

      {clients.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-left text-[15px]">
            <thead className="bg-surface text-sm text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-semibold">Klient</th>
                {STEPS.map((s) => (
                  <th key={s.key} className="px-2 py-3 text-center font-semibold">
                    {s.label}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">Pokladna</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.label ?? "—"}</p>
                    <p className="text-sm text-muted">IČO {c.ico}</p>
                  </td>
                  {STEPS.map((s) => (
                    <td key={s.key} className="px-2 py-3 text-center">
                      {c.readiness.source === "pokladna" ? (
                        <span aria-label={c.readiness[s.key] ? "hotovo" : "chybí"} className={c.readiness[s.key] ? "text-brand-600" : "text-muted"}>
                          {c.readiness[s.key] ? "✓" : "–"}
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`${s.label} – ${c.label ?? c.ico}`}
                          checked={c.readiness[s.key]}
                          className="h-5 w-5 accent-brand-600"
                          onChange={(e) =>
                            act(async () => {
                              const { source: _s, ...manual } = c.readiness;
                              await call(`/api/kabinet/klienti/${c.id}`, { method: "PATCH", json: { manualStatus: { ...manual, [s.key]: e.target.checked } } });
                              await reload();
                            })
                          }
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm">
                    {c.linked ? (
                      <span className="chip bg-brand-100 text-brand-700">Propojeno{c.mode === "production" ? " · ostrý provoz" : ""}</span>
                    ) : c.inviteUrl ? (
                      <button type="button" className="font-medium text-brand-700 underline" onClick={() => act(async () => (await navigator.clipboard.writeText(c.inviteUrl!), setInfo("Odkaz zkopírován – pošlete ho klientovi.")))}>
                        Kopírovat pozvánku
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="font-medium text-brand-700 underline"
                        onClick={() =>
                          act(async () => {
                            const r = await call<{ url: string }>(`/api/kabinet/klienti/${c.id}/pozvanka`, { method: "POST" });
                            await navigator.clipboard.writeText(r.url).catch(() => {});
                            setInfo(`Pozvánka vytvořena a zkopírována: ${r.url}`);
                            await reload();
                          })
                        }
                      >
                        Pozvat do pokladny
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-sm text-muted hover:text-danger-600"
                      onClick={() => act(async () => (confirm(`Odebrat klienta ${c.label ?? c.ico}?`) && (await call(`/api/kabinet/klienti/${c.id}`, { method: "DELETE" })), await reload()))}
                    >
                      Odebrat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ExportBox />

      <p className="text-sm text-muted">
        U propojených klientů se stav připravenosti zjišťuje automaticky z jejich pokladny EvidujZdarma. U ostatních ho můžete vést ručně. Klient propojení potvrzuje sám
        přes pozvánku a může ho kdykoli zrušit.
      </p>
    </div>
  );
}

function CreateCabinet({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [ico, setIco] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-3xl font-extrabold">Založit účetní kabinet</h1>
      <p className="mt-2 text-ink-soft">Zdarma: přehled připravenosti všech klientů na EET 2.0, pozvánky do pokladny a export tržeb.</p>
      <form
        className="card mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await call("/api/kabinet", { method: "POST", json: { name, ico: ico || undefined, acceptTerms: terms } });
            await onCreated();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Nepodařilo se");
          }
        }}
      >
        <div>
          <label htmlFor="cab-name" className="label">
            Název kanceláře
          </label>
          <input id="cab-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cab-ico" className="label">
            IČO <span className="font-normal text-muted">(nepovinné)</span>
          </label>
          <input id="cab-ico" className="input" inputMode="numeric" value={ico} onChange={(e) => setIco(e.target.value)} />
        </div>
        <label className="flex items-start gap-3 text-[15px] text-ink-soft">
          <input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
          <span>
            Souhlasím s{" "}
            <a href="/podminky" target="_blank" className="underline">
              obchodními podmínkami
            </a>
            . Jak zpracováváme osobní údaje, popisují{" "}
            <a href="/ochrana-osobnich-udaju" target="_blank" className="underline">
              zásady ochrany osobních údajů
            </a>
            .
          </span>
        </label>
        {error && <p className="text-danger-600">{error}</p>}
        <button type="submit" className="btn-primary w-full">
          Založit kabinet
        </button>
      </form>
    </div>
  );
}

function AddClients({ onAdded }: { onAdded: (msg: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await call<{ added: number; duplicates: number; invalid: string[] }>("/api/kabinet/klienti", { method: "POST", json: { text } });
          setText("");
          await onAdded(`Přidáno ${r.added} klientů${r.duplicates ? `, ${r.duplicates} už v seznamu bylo` : ""}${r.invalid.length ? `, neplatná IČO: ${r.invalid.slice(0, 5).join(", ")}` : ""}.`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Nepodařilo se");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="cab-icos" className="label">
        Přidat klienty – vložte IČO (oddělená čárkou nebo novým řádkem)
      </label>
      <textarea id="cab-icos" rows={3} className="input font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p className="mt-2 text-danger-600">{error}</p>}
      <button type="submit" className="btn-primary mt-3" disabled={busy || !text.trim()}>
        {busy ? "Přidávám…" : "Přidat klienty"}
      </button>
    </form>
  );
}

function ExportBox() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  return (
    <div className="card flex flex-wrap items-end gap-3">
      <div className="mr-auto">
        <h2 className="text-lg font-bold">Export tržeb propojených klientů</h2>
        <p className="text-sm text-muted">CSV pro Excel a účetní software. Pohoda / Money S3 / ABRA v partnerském tarifu.</p>
      </div>
      <input aria-label="Od" type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
      <input aria-label="Do" type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
      <a href={`/api/kabinet/export?od=${from}&do=${to}`} className="btn-secondary">
        Stáhnout CSV
      </a>
    </div>
  );
}
