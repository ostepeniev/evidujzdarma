"use client";

import Link from "next/link";
import { useState } from "react";
import { PartnerBadge } from "@/components/accountant/partner-badge";
import { call } from "@/components/setup/api";
import { ACCOUNTANT_REWARD_DISCLOSURE, setupReferralPath } from "@/content/services";
import { clarityEvent } from "@/lib/clarity-event";
import { pragueToday } from "@/lib/prague-time";
import { SITE_URL } from "@/lib/site";

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
  inviteExpiresAt: string | null;
  readiness: Readiness;
  lastSaleAt: string | null;
  mode: string | null;
}
interface ReferredOrder {
  id: string;
  createdAt: string;
  service: string;
  companyName: string | null;
  ico: string | null;
  status: string;
  statusLabel: string;
  reward: number;
}
export interface CabinetState {
  user: { email: string };
  account: { id: string; name: string; ico: string | null } | null;
  clients: Client[];
  /** S11: kód kanceláře pro osobní odkaz /nastaveni-na-klic?ref=<kód> */
  partnerCode: string | null;
  referred: { orders: ReferredOrder[]; rewardTotal: number };
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
                        {c.invited ? "Nová pozvánka" : "Pozvat do pokladny"}
                      </button>
                    )}
                    {!c.linked && c.invited && c.inviteExpiresAt && (
                      <span className="block text-xs text-muted">Pozvánka platí do {new Date(c.inviteExpiresAt).toLocaleDateString("cs-CZ")}</span>
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

      <ExportBox clients={clients.filter((c) => c.linked)} />

      {state.partnerCode && <Referrals code={state.partnerCode} referred={state.referred} />}

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

function ExportBox({ clients }: { clients: Client[] }) {
  // dnešek v Praze, ne v UTC – mezi půlnocí a 1–2 h ráno by jinak výchozí „do“ byl včerejšek (S3-POKLADNA)
  const today = pragueToday();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [ico, setIco] = useState(clients[0]?.ico ?? "");
  const [cashAccount, setCashAccount] = useState("HP");
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h2 className="text-lg font-bold">Export tržeb propojených klientů</h2>
          <p className="text-sm text-muted">CSV pro Excel a účetní software, Pohoda XML (beta) po klientech. Money S3 a ABRA připravujeme.</p>
        </div>
        <input aria-label="Od" type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input aria-label="Do" type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        <a href={`/api/kabinet/export?od=${from}&do=${to}`} className="btn-secondary">
          Stáhnout CSV
        </a>
      </div>
      {clients.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4" data-export="pohoda">
          <div className="mr-auto max-w-md">
            <h3 className="font-semibold">Pohoda XML (beta)</h3>
            <p className="text-sm text-muted">
              Denní souhrny za každou evidenční jednotku: hotovost jako příjmový pokladní doklad, ostatní platby jako interní doklad, s rozpisem DPH.
              Vratky se odečtou. Jen ostrý provoz. Pohoda soubor naimportuje do firmy se stejným IČO.
            </p>
          </div>
          <label className="text-sm">
            <span className="label">Klient</span>
            <select className="input w-auto" value={ico} onChange={(e) => setIco(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.ico}>
                  {c.label ? `${c.label} (${c.ico})` : c.ico}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="label">Pokladna v Pohodě</span>
            <input className="input w-24" maxLength={19} value={cashAccount} onChange={(e) => setCashAccount(e.target.value)} />
          </label>
          <a href={`/api/kabinet/export/pohoda?klient=${ico}&od=${from}&do=${to}&pokladna=${encodeURIComponent(cashAccount)}`} className="btn-secondary">
            Stáhnout Pohoda XML
          </a>
        </div>
      )}
    </div>
  );
}

/** S11: osobní odkaz kanceláře na Nastavení na klíč a doporučená nastavení s odměnou (výplata ručně). */
function Referrals({ code, referred }: { code: string; referred: CabinetState["referred"] }) {
  const url = `${SITE_URL}${setupReferralPath(code)}`;
  const [copied, setCopied] = useState(false);
  return (
    <section id="odkaz" className="card scroll-mt-24 space-y-5" aria-labelledby="odkaz-h">
      <div>
        <h2 id="odkaz-h" className="text-lg font-bold">
          Nastavení na klíč pro vaše klienty
        </h2>
        <p className="mt-1 text-[15px] text-ink-soft">
          Pošlete klientovi svůj odkaz. S nastavením DIS+, evidenčních jednotek a pokladního certifikátu mu pomůžeme my. {ACCOUNTANT_REWARD_DISCLOSURE}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Váš odkaz pro klienty" readOnly value={url} className="input min-w-0 flex-1 font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              clarityEvent("acc_ref_link_copy");
              setTimeout(() => setCopied(false), 2500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Zkopírováno" : "Kopírovat odkaz"}
        </button>
      </div>
      <p className="text-sm text-muted">
        Kód kanceláře: <code className="rounded bg-surface px-1">{code}</code>. Klient, který přes odkaz přijde, se vám připíše na 90 dní (funkční cookie jen
        na stránce nastavení).{" "}
        <a href="/pravidla-doporuceni#ucetni" className="underline underline-offset-2">
          Pravidla odměny
        </a>
      </p>

      <div>
        <h3 className="font-semibold">Doporučená nastavení</h3>
        {referred.orders.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Zatím žádná poptávka přes váš odkaz.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[15px]" data-referred-orders="">
              <thead className="text-sm text-ink-soft">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Datum</th>
                  <th className="py-2 pr-3 font-semibold">Klient</th>
                  <th className="py-2 pr-3 font-semibold">Služba</th>
                  <th className="py-2 pr-3 font-semibold">Stav</th>
                  <th className="py-2 text-right font-semibold">Odměna</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {referred.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-3">{new Date(o.createdAt).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" })}</td>
                    <td className="py-2 pr-3">
                      {o.companyName ?? "—"}
                      {o.ico && <span className="block text-sm text-muted">IČO {o.ico}</span>}
                    </td>
                    <td className="py-2 pr-3">{o.service}</td>
                    <td className="py-2 pr-3">{o.statusLabel}</td>
                    <td className="py-2 text-right">{o.reward ? `${o.reward} Kč` : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line font-semibold">
                  <td className="py-2 pr-3" colSpan={4}>
                    Odměna celkem (vyplácíme ručně)
                  </td>
                  <td className="py-2 text-right">{referred.rewardTotal} Kč</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <details>
        <summary className="cursor-pointer font-semibold">Odznak „Partner EvidujZdarma“ na web kanceláře</summary>
        <div className="mt-3">
          <PartnerBadge code={code} />
        </div>
      </details>
    </section>
  );
}
