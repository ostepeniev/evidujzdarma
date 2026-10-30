import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";
import { ENV_LABEL, SCOPES } from "@/content/api-scopes";
import { getCurrentUser } from "@/lib/server/auth";
import { liveRefusal } from "@/lib/server/integrations";
import { checkAuthorize, ownerAccounts, returnUrl } from "@/lib/server/oauth";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Připojit aplikaci", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";


function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface px-4 py-10">
      <main className="card mx-auto max-w-lg space-y-5 p-6">
        {children}
        <p className="text-xs text-muted">{SITE.independenceNotice}</p>
      </main>
    </div>
  );
}

const PASS = ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "environment", "response_type"] as const;

/**
 * Připojení aplikace partnera jedním klikem (S8, rozd. 6): přihlášení vlastníka, výběr účtu, jednotek, souhrn oprávnění,
 * Povolit / Zrušit. Formulář jde na /api/ucet/pripojit (session, jen z našeho původu). Stránku nejde vložit do rámu.
 */
export default async function ConnectPage({ searchParams }: PageProps<"/pripojit">) {
  const sp = await searchParams;
  const params = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
  if (!hasDatabase()) return <Shell>Služba je dočasně nedostupná.</Shell>;
  const check = await checkAuthorize(params);
  if (check.kind === "fatal") {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Připojení nelze dokončit</h1>
        <p role="alert" className="text-danger-600">
          {check.message}
        </p>
      </Shell>
    );
  }
  if (check.kind === "redirect_error") redirect(returnUrl(check.redirectUri, { error: check.error, error_description: check.description, state: check.state }));
  const ok = check as Extract<typeof check, { kind: "ok" }>;

  const user = await getCurrentUser();
  if (!user) {
    const here = `/pripojit?${new URLSearchParams(Object.entries(params).filter(([, v]) => typeof v === "string") as [string, string][]).toString()}`;
    redirect(`/prihlaseni?redirect=${encodeURIComponent(here)}`);
  }
  const accounts = ownerAccounts(user!);
  if (!accounts.length) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Připojit {ok.partner.name}</h1>
        <p>Aplikaci může připojit jen vlastník účtu EvidujZdarma.</p>
      </Shell>
    );
  }
  const chosen = params.account && accounts.some((a) => a.accountId === params.account) ? params.account : accounts.length === 1 ? accounts[0]!.accountId : null;
  if (!chosen) {
    const base = new URLSearchParams(Object.entries(params).filter(([k, v]) => k !== "account" && typeof v === "string") as [string, string][]);
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Připojit {ok.partner.name}</h1>
        <p className="font-semibold">Vyberte účet, ke kterému aplikaci připojíte:</p>
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li key={a.accountId}>
              <a className="btn-secondary w-full justify-start" href={`/pripojit?${base.toString()}&account=${a.accountId}`}>
                {a.accountName}
              </a>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }
  const account = accounts.find((a) => a.accountId === chosen)!;
  const units = await getDb().select({ id: schema.evidenceUnits.id, label: schema.evidenceUnits.label }).from(schema.evidenceUnits).where(eq(schema.evidenceUnits.accountId, chosen));
  const liveBlocked = ok.environment === "live" ? await liveRefusal(chosen) : null;
  return (
    <Shell>
      <h1 className="text-2xl font-bold">Připojit {ok.partner.name}</h1>
      <p>
        Aplikace <strong>{ok.partner.name}</strong> chce evidovat tržby za účet <strong>{account.accountName}</strong> v prostředí <strong>{ENV_LABEL[ok.environment]}</strong>.
        Tržby z ní se evidují stejně jako z pokladny.
      </p>
      <form method="post" action="/api/ucet/pripojit" className="space-y-5">
        {PASS.map((k) => (params[k] ? <input key={k} type="hidden" name={k} value={params[k]} /> : null))}
        <input type="hidden" name="account" value={chosen} />
        <fieldset>
          <legend className="label">Evidenční jednotky</legend>
          {units.length ? (
            units.map((u) => (
              <label key={u.id} className="flex items-center gap-2 py-1">
                <input type="checkbox" name="unitIds" value={u.id} defaultChecked={units.length === 1} />
                {u.label}
              </label>
            ))
          ) : (
            <p className="text-sm text-muted">Účet zatím nemá evidenční jednotky – přidejte je v nastavení pokladny.</p>
          )}
        </fieldset>
        <div>
          <p className="label">Oprávnění</p>
          <ul className="list-disc space-y-1 pl-5">
            {SCOPES.filter((s) => ok.scopes.includes(s.id as never)).map((s) => (
              <li key={s.id}>
                {s.label}
                {s.hint && <span className="block text-sm text-muted">{s.hint}</span>}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-ink-soft">Integraci můžete kdykoli odpojit na stránce Integrace. Tržby, které už aplikace předala, se do EET odešlou.</p>
        {liveBlocked && (
          <p role="alert" className="text-danger-600">
            {liveBlocked}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="decision" value="allow" className="btn-primary" disabled={!!liveBlocked}>
            Povolit
          </button>
          <button type="submit" name="decision" value="deny" className="btn-secondary">
            Zrušit
          </button>
        </div>
      </form>
    </Shell>
  );
}
