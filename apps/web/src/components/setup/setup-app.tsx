"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { formatCzk } from "@ez/fiscal-core";
import { getDevice, setMeta, deleteMeta } from "@/lib/pos/db";
import { requestPersistentStorage, type PersistState } from "@/lib/pos/storage";
import type { DeviceCredentials, PosConfig } from "@/lib/pos/types";
import { FACTS } from "@/content/facts";
import { pragueToday } from "@/lib/prague-time";
import { ApiError, call, UNIT_TYPE_LABEL, type AccountStateDto } from "./api";

const MODE_LABEL: Record<string, string> = { mock: "ukázkový", playground: "Playground", production: "ostrý provoz" };

type State = AccountStateDto;

function Section({ id, step, title, done, children, lead }: { id: string; step: number; title: string; done?: boolean; children: ReactNode; lead?: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20" aria-labelledby={`${id}-h`}>
      <div className="flex items-start gap-4">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-brand-600 text-white" : "bg-surface-2 text-ink-soft"}`}>{done ? "✓" : step}</span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-h`} className="text-xl font-bold">
            {title}
          </h2>
          {lead && <div className="mt-1 text-[15px] text-ink-soft">{lead}</div>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Značka chyby „přihlaste se znovu“ (citlivý krok chce čerstvé přihlášení, R3.7). */
const REAUTH_PREFIX = "\u0000reauth:";

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  if (error.startsWith(REAUTH_PREFIX)) return <ReauthNotice message={error.slice(REAUTH_PREFIX.length)} />;
  return (
    <p role="alert" className="mt-3 rounded-xl bg-danger-50 p-3 text-[15px] text-danger-600">
      {error}
    </p>
  );
}

function ReauthNotice({ message }: { message: string }) {
  const [sent, setSent] = useState<string | null>(null);
  return (
    <div role="alert" className="mt-3 rounded-xl bg-sun-100 p-3 text-[15px]">
      <p>{message}</p>
      {sent ? (
        <p className="mt-2 font-semibold">{sent}</p>
      ) : (
        <button
          type="button"
          className="btn-secondary mt-2 py-1.5 text-sm"
          onClick={async () => {
            const state = await call<AccountStateDto>("/api/ucet");
            await call("/api/auth/login", { method: "POST", json: { email: state.user.email, redirectTo: "/pokladna/nastaveni" } });
            setSent(`Odkaz jsme poslali na ${state.user.email}. Otevřete ho v tomto prohlížeči a krok zopakujte.`);
          }}
        >
          Poslat přihlašovací odkaz
        </button>
      )}
    </div>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const reauth = e instanceof ApiError && (e.data as { reauth?: boolean } | undefined)?.reauth;
      setError(e instanceof Error ? (reauth ? REAUTH_PREFIX + e.message : e.message) : "Něco se nepovedlo");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

export function SetupApp({ initial }: { initial: State }) {
  const [state, setState] = useState<State>(initial);
  const reload = async () => setState(await call<State>("/api/ucet"));
  const acc = state.account;
  const units = (state.units ?? []).filter((u) => u.active);
  const prodCert = state.certificates?.find((c) => c.environment === "production");
  const pgCert = state.certificates?.find((c) => c.environment === "playground");

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Nastavení pokladny</h1>
          <p className="text-[15px] text-ink-soft">EET za 15 minut – krok za krokem. Přihlášen: {state.user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pokladna" className="btn-primary">
            Otevřít pokladnu
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              await call("/api/auth/logout", { method: "POST" });
              location.href = "/prihlaseni";
            }}
          >
            Odhlásit
          </button>
        </div>
      </header>

      {acc?.closedAt && (
        <p role="alert" className="rounded-3xl border-2 border-danger-600 bg-white p-5 text-[15px]">
          <strong className="text-danger-600">Účet je zrušený.</strong> Certifikáty už nefungují a pokladny neprodávají – jen odešlou uložené tržby. Data smažeme{" "}
          {new Date(new Date(acc.closedAt).getTime() + 30 * 86_400_000).toLocaleDateString("cs-CZ")} – do té doby si stáhněte export tržeb níže.
        </p>
      )}
      <CompanySection state={state} onSaved={setState} />
      {acc && (
        <>
          <Section
            id="dis"
            step={2}
            title="Přihlášení k evidenci v DIS+"
            lead={
              <>
                Od 1. 11. 2026 se v DIS+ (MOJE daně) přihlaste k evidenci tržeb, oznamte evidenční jednotky a vygenerujte pokladní certifikát.{" "}
                <Link href="/navody/jak-aktivovat-dis-a-certifikat" className="font-medium text-brand-700 underline" target="_blank">
                  Návod krok za krokem
                </Link>
                . Do té doby můžete pokladnu zkoušet v ukázkovém režimu.
              </>
            }
          >
            <p className="text-sm text-muted">Tento krok se dělá na webu Finanční správy – my vás jen provedeme.</p>
          </Section>
          <UnitsSection state={state} reload={reload} />
          <CertificateSection state={state} reload={reload} />
          <ModeSection state={state} reload={reload} hasProdCert={!!prodCert} hasPgCert={!!pgCert} />
          <DeviceSection state={state} reload={reload} />
          <StaffSection state={state} reload={reload} />
          <CatalogSection state={state} reload={reload} />
          <ExportSection salesCount={state.salesCount ?? 0} />
          <ClosingsSection />
          <ProblemSalesSection />
          <FailedSalesSection />
          <AccountantsSection state={state} reload={reload} />
          {!acc.closedAt && <CloseAccountSection reload={reload} />}
        </>
      )}
      <p className="pt-4 text-center text-xs text-muted">
        {units.length}/{state.limits?.units ?? 3} evidenčních jednotek · {(state.staff ?? []).filter((s) => s.active).length}/{state.limits?.staff ?? 5} uživatelů · tarif{" "}
        {acc?.plan === "free" ? "Zdarma" : acc?.plan}
      </p>
    </div>
  );
}

/* ───────────── 1. Firma ───────────── */

function CompanySection({ state, onSaved }: { state: State; onSaved: (s: State) => void }) {
  const acc = state.account;
  const [form, setForm] = useState({
    name: acc?.name ?? "",
    ico: acc?.ico ?? "",
    dic: acc?.dic ?? "",
    eic: acc?.eic && acc.eic !== acc.dic ? acc.eic : "",
    vatPayer: acc?.vatPayer ?? false,
    iban: acc?.iban ?? "",
    receiptFooter: acc?.receiptFooter ?? "",
    receiptShowPok: acc?.receiptShowPok ?? true,
    ownerName: "",
    acceptTerms: false,
  });
  const { busy, error, run } = useAction();
  const [lookup, setLookup] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function fromAres() {
    setLookup("Hledám v ARES…");
    try {
      const data = await call<{ subject: { name: string; dic: string | null; vatPayer: boolean } }>(`/api/ico/${form.ico.replace(/\s+/g, "")}`);
      setForm((f) => ({ ...f, name: data.subject.name, dic: data.subject.dic ?? f.dic, vatPayer: data.subject.vatPayer }));
      setLookup(`Načteno z ARES: ${data.subject.name}`);
    } catch (e) {
      setLookup(e instanceof Error ? e.message : "Nenalezeno");
    }
  }

  return (
    <Section id="firma" step={1} title="Firma" done={!!acc} lead="Údaje se tisknou na účtenku. DIČ / EIČ je identifikace pro Finanční správu.">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            onSaved(
              await call<State>("/api/ucet", {
                method: "POST",
                json: { ...form, ico: form.ico || undefined, dic: form.dic || undefined, eic: form.eic || undefined, iban: form.iban || undefined, ownerName: form.ownerName || undefined },
              }),
            );
          });
        }}
      >
        <div>
          <label htmlFor="f-ico" className="label">
            IČO
          </label>
          <div className="flex gap-2">
            <input id="f-ico" className="input" inputMode="numeric" value={form.ico} onChange={(e) => set("ico", e.target.value)} />
            <button type="button" className="btn-secondary shrink-0 px-3" onClick={fromAres} disabled={form.ico.replace(/\D/g, "").length < 6}>
              ARES
            </button>
          </div>
          {lookup && <p className="mt-1 text-sm text-muted">{lookup}</p>}
        </div>
        <div>
          <label htmlFor="f-name" className="label">
            Název / jméno *
          </label>
          <input id="f-name" className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label htmlFor="f-dic" className="label">
            DIČ
          </label>
          <input id="f-dic" className="input" placeholder="CZ12345678" value={form.dic} onChange={(e) => set("dic", e.target.value)} />
        </div>
        <div>
          <label htmlFor="f-eic" className="label">
            EIČ pro EET <span className="font-normal text-muted">(jen pokud se liší od DIČ)</span>
          </label>
          <input id="f-eic" className="input" placeholder="CZ…" value={form.eic} onChange={(e) => set("eic", e.target.value)} />
        </div>
        <div>
          <label htmlFor="f-iban" className="label">
            Číslo účtu pro QR platby
          </label>
          <input id="f-iban" className="input" placeholder="123456789/0100 nebo IBAN" value={form.iban} onChange={(e) => set("iban", e.target.value)} />
        </div>
        {!acc && (
          <div>
            <label htmlFor="f-owner" className="label">
              Vaše jméno v pokladně
            </label>
            <input id="f-owner" className="input" placeholder="např. Jana" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
          </div>
        )}
        <div className="sm:col-span-2">
          <label htmlFor="f-footer" className="label">
            Patička účtenky
          </label>
          <input id="f-footer" className="input" placeholder="Děkujeme za návštěvu!" value={form.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value)} />
        </div>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input type="checkbox" checked={form.vatPayer} onChange={(e) => set("vatPayer", e.target.checked)} className="h-5 w-5 accent-brand-600" />
          Jsem plátce DPH (na účtence se zobrazí rozpis DPH)
        </label>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.receiptShowPok} onChange={(e) => set("receiptShowPok", e.target.checked)} className="h-5 w-5 accent-brand-600" />
            Uvádět na účtence potvrzovací kód (POK)
          </label>
          <p className="mt-1 pl-8 text-sm text-muted">
            {FACTS.confirmation.onReceipt} S kódem zákazník vidí, že tržba prošla evidencí; bez něj je účtenka kratší. V pokladně i v exportu POK zůstává vždy.
          </p>
        </div>
        {!acc && (
          <label className="flex items-start gap-3 text-[15px] text-ink-soft sm:col-span-2">
            <input type="checkbox" required checked={form.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
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
        )}
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Ukládám…" : acc ? "Uložit změny" : "Pokračovat"}
          </button>
          <ErrorText error={error} />
        </div>
      </form>
    </Section>
  );
}

/* ───────────── 3. Evidenční jednotky ───────────── */

function UnitsSection({ state, reload }: { state: State; reload: () => Promise<void> }) {
  const units = (state.units ?? []).filter((u) => u.active);
  const [form, setForm] = useState({ type: "stala_provozovna", label: "", fsUnitId: "", address: "" });
  const { busy, error, run } = useAction();
  return (
    <Section
      id="jednotky"
      step={3}
      title="Evidenční jednotky"
      done={units.length > 0 && units.every((u) => u.fsUnitId)}
      lead={
        <>
          Místa, kde přijímáte tržby. Číslo jednotky vám přidělí Finanční správa v DIS+ – do té doby ho nechte prázdné.{" "}
          <Link href="/evidencni-jednotky" target="_blank" className="font-medium text-brand-700 underline">
            Které jednotky oznámit?
          </Link>
        </>
      }
    >
      {units.length > 0 && (
        <ul className="mb-4 divide-y divide-line rounded-2xl border border-line">
          {units.map((u) => (
            <UnitRow key={u.id} unit={u} reload={reload} />
          ))}
        </ul>
      )}
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await call("/api/ucet/jednotky", {
              method: "POST",
              json: { type: form.type, label: form.label, fsUnitId: form.fsUnitId ? Number(form.fsUnitId) : null, address: form.address || null },
            });
            setForm({ type: "stala_provozovna", label: "", fsUnitId: "", address: "" });
            await reload();
          });
        }}
      >
        <select aria-label="Typ jednotky" className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {Object.entries(UNIT_TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input aria-label="Název jednotky" required className="input" placeholder="Název, např. Salon Masarykova" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input aria-label="Číslo jednotky z DIS+" className="input" inputMode="numeric" placeholder="Číslo jednotky z DIS+ (pokud už máte)" value={form.fsUnitId} onChange={(e) => setForm({ ...form, fsUnitId: e.target.value.replace(/\D/g, "") })} />
        <input aria-label="Adresa" className="input" placeholder="Adresa (tiskne se na účtenku)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <div className="sm:col-span-2">
          <button type="submit" className="btn-secondary" disabled={busy}>
            + Přidat jednotku
          </button>
          <ErrorText error={error} />
        </div>
      </form>
    </Section>
  );
}

function UnitRow({ unit, reload }: { unit: NonNullable<State["units"]>[number]; reload: () => Promise<void> }) {
  const [fsId, setFsId] = useState(unit.fsUnitId ? String(unit.fsUnitId) : "");
  const { busy, error, run } = useAction();
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{unit.label}</p>
        <p className="text-sm text-muted">
          {UNIT_TYPE_LABEL[unit.type]}
          {unit.address && ` · ${unit.address}`}
        </p>
      </div>
      <input aria-label={`Číslo jednotky ${unit.label}`} className="input w-36 py-2" inputMode="numeric" placeholder="Číslo z DIS+" value={fsId} onChange={(e) => setFsId(e.target.value.replace(/\D/g, ""))} />
      <button
        type="button"
        className="btn-secondary px-3 py-2"
        disabled={busy || fsId === (unit.fsUnitId ? String(unit.fsUnitId) : "")}
        onClick={() => void run(async () => (await call(`/api/ucet/jednotky/${unit.id}`, { method: "PATCH", json: { fsUnitId: fsId ? Number(fsId) : null } }), await reload()))}
      >
        Uložit
      </button>
      <button type="button" className="px-2 text-sm text-muted hover:text-danger-600" onClick={() => void run(async () => (await call(`/api/ucet/jednotky/${unit.id}`, { method: "DELETE" }), await reload()))}>
        Odebrat
      </button>
      {error && <p className="w-full text-sm text-danger-600">{error}</p>}
    </li>
  );
}

/* ───────────── 4. Certifikát ───────────── */

function CertificateSection({ state, reload }: { state: State; reload: () => Promise<void> }) {
  const certs = state.certificates ?? [];
  const [environment, setEnvironment] = useState<"" | "production" | "playground">("");
  const { busy, error, run } = useAction();
  return (
    <Section
      id="certifikat"
      step={4}
      title="Pokladní certifikát"
      done={certs.some((c) => c.environment === "production")}
      lead="Certifikát (.p12) vygenerujete zdarma v DIS+. Privátní klíč ukládáme šifrovaně na serverech v EU a dešifrujeme ho jen v paměti při odeslání tržby. Heslo k certifikátu neukládáme."
    >
      {certs.length > 0 && (
        <ul className="mb-4 space-y-2">
          {certs.map((c) => (
            <li key={c.id} className="rounded-2xl bg-surface p-3 text-[15px]">
              <strong>{c.environment === "production" ? "Ostrý certifikát" : "Testovací (Playground)"}</strong> · EIČ {c.eic ?? "—"} · platný do {new Date(c.validTo).toLocaleDateString("cs-CZ")}
              {c.environment === "production" && <span className="ml-1 text-muted">· {c.verifiedAt ? "ověřeno" : "zatím neověřeno – použijte „Odeslat ověřovací tržbu“"}</span>}
              <button
                type="button"
                className="ml-2 text-sm text-muted underline hover:text-danger-600"
                disabled={busy}
                onClick={() =>
                  window.confirm("Odstranit certifikát ze služby? Smažeme i jeho šifrovaný klíč. V DIS+ ho můžete zneplatnit.") &&
                  void run(async () => {
                    await call(`/api/ucet/certifikat/${c.id}`, { method: "DELETE" });
                    await reload();
                  })
                }
              >
                Odstranit
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          // prostředí pozná server podle vydavatele; volba jen kontroluje, že jde o očekávaný certifikát
          if (environment) fd.set("environment", environment);
          else fd.delete("environment");
          const formEl = e.currentTarget;
          void run(async () => {
            const res = await fetch("/api/ucet/certifikat", { method: "POST", body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new ApiError(data.error ?? "Nahrání se nezdařilo", res.status, data);
            formEl.reset();
            await reload();
          });
        }}
      >
        <input aria-label="Soubor certifikátu" name="file" type="file" accept=".p12,.pfx,application/x-pkcs12" required className="input py-2 sm:col-span-2" />
        <input aria-label="Heslo k certifikátu" name="password" type="password" autoComplete="off" className="input" placeholder="Heslo k certifikátu" />
        <select aria-label="Prostředí" className="input" value={environment} onChange={(e) => setEnvironment(e.target.value as "" | "production" | "playground")}>
          <option value="">Rozpoznat podle certifikátu</option>
          <option value="production">Ostrý certifikát (z DIS+)</option>
          <option value="playground">Testovací certifikát (Playground)</option>
        </select>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-secondary" disabled={busy}>
            {busy ? "Nahrávám…" : "Nahrát certifikát"}
          </button>
          <ErrorText error={error} />
        </div>
      </form>
    </Section>
  );
}

/* ───────────── 5. Režim a test ───────────── */

function ModeSection({ state, reload, hasProdCert, hasPgCert }: { state: State; reload: () => Promise<void>; hasProdCert: boolean; hasPgCert: boolean }) {
  const mode = state.account!.eetMode;
  const units = (state.units ?? []).filter((u) => u.active);
  const { busy, error, run } = useAction();
  const [result, setResult] = useState<string | null>(null);
  const MODES = [
    { v: "mock", l: "Ukázkový režim", d: "Vyzkoušejte si pokladnu. Nic se neodesílá Finanční správě." },
    { v: "playground", l: "Testovací prostředí FS", d: "Odesílá na Playground Finanční správy (potřebuje testovací certifikát)." },
    { v: "production", l: "Ostrý provoz", d: "Tržby se evidují u Finanční správy. Potřebuje certifikát z DIS+ a čísla jednotek." },
  ] as const;
  return (
    <Section id="rezim" step={5} title="Režim evidence a testovací tržba" done={mode === "production"} lead="Vyzkoušejte si pokladnu ještě před 1. 1. 2027 – v ukázkovém režimu nebo na Playgroundu Finanční správy. Od 1. 1. 2027 se eviduje naostro. Ověřovací tržbu Finanční správa zkontroluje, ale neeviduje.">
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => {
          const disabled = (m.v === "production" && !hasProdCert) || (m.v === "playground" && !hasPgCert);
          return (
            <button
              key={m.v}
              type="button"
              disabled={busy || disabled}
              aria-pressed={mode === m.v}
              onClick={() =>
                void run(async () => {
                  try {
                    await call("/api/ucet/rezim", { method: "POST", json: { mode: m.v } });
                  } catch (e) {
                    const pending = e instanceof ApiError && e.status === 409 ? (e.data as { pending?: { mode: string; count: number; oldest: string }[] }).pending : undefined;
                    if (!pending) throw e;
                    const list = pending.map((p) => `• ${p.count}× v režimu ${MODE_LABEL[p.mode] ?? p.mode} (nejstarší ${new Date(p.oldest).toLocaleString("cs-CZ")})`).join("\n");
                    const ok = window.confirm(`Tyto tržby ještě nejsou vyřízené:\n${list}\n\nOdešlou se v režimu, ve kterém vznikly – přepnutí na ně nemá vliv. Přepnout režim?`);
                    if (!ok) return;
                    await call("/api/ucet/rezim", { method: "POST", json: { mode: m.v, confirm: true } });
                  }
                  await reload();
                })
              }
              className={`rounded-2xl border p-4 text-left disabled:opacity-50 ${mode === m.v ? "border-brand-600 bg-brand-50" : "border-line bg-white"}`}
            >
              <span className="block font-semibold">{m.l}</span>
              <span className="mt-1 block text-sm text-ink-soft">{m.d}</span>
            </button>
          );
        })}
      </div>
      {units[0] && (
        <div className="mt-4">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setResult(null);
                const r = await call<{ ok: boolean; mode: string; message?: string; code?: string; simulated?: boolean; warnings?: { code: number; text: string }[] }>("/api/ucet/overeni", {
                  method: "POST",
                  json: { unitId: units[0]!.id },
                });
                const warn = r.warnings?.length ? ` Upozornění FS: ${r.warnings.map((w) => w.text).join("; ")}` : "";
                setResult(
                  r.ok
                    ? r.simulated || r.mode === "mock"
                      ? "Ukázkový režim: nic se do FS neodeslalo, certifikát tím ověřený není."
                      : `Finanční správa (${MODE_LABEL[r.mode] ?? r.mode}) ověřovací zprávu přijala – certifikát, EIČ i číslo jednotky jsou v pořádku.${warn}`
                    : `Finanční správa zprávu odmítla: ${r.message ?? r.code}`,
                );
              })
            }
          >
            Odeslat ověřovací tržbu
          </button>
          {result && (
            <p role="status" className="mt-3 rounded-xl bg-surface p-3 text-[15px]">
              {result}
            </p>
          )}
        </div>
      )}
      <ErrorText error={error} />
    </Section>
  );
}

/* ───────────── 6. Toto zařízení ───────────── */

function DeviceSection({ state, reload }: { state: State; reload: () => Promise<void> }) {
  const units = (state.units ?? []).filter((u) => u.active);
  const devices = state.devices ?? [];
  const [local, setLocal] = useState<DeviceCredentials | null | undefined>(undefined);
  const [form, setForm] = useState({ name: "Pokladna", registerId: `P${devices.length + 1}`, unitId: units[0]?.id ?? "" });
  const { busy, error, run } = useAction();

  useEffect(() => {
    void getDevice().then((d) => setLocal(d ?? null));
  }, []);

  const thisDevice = local ? devices.find((d) => d.id === local.deviceId) : undefined;
  const [persist, setPersist] = useState<PersistState | null>(null);
  useEffect(() => {
    if (local) void requestPersistentStorage().then(setPersist);
  }, [local]);

  return (
    <Section id="zarizeni" step={6} title="Toto zařízení jako pokladna" done={!!thisDevice} lead="Zařízení dostane vlastní klíč – pokladní se pak přihlašují jen PINem, i bez internetu.">
      {thisDevice ? (
        <>
          <p className="rounded-2xl bg-brand-50 p-4 text-[15px]">
            Toto zařízení je pokladna <strong>{thisDevice.registerId}</strong> ({thisDevice.name}).{" "}
            <Link href="/pokladna" className="font-semibold text-brand-700 underline">
              Otevřít pokladnu →
            </Link>
          </p>
          {persist && persist !== "granted" && (
            // R1.12: bez trvalého úložiště smí prohlížeč IndexedDB smazat i s neodeslanými tržbami
            <p role="alert" className="mt-3 rounded-2xl bg-sun-100 p-4 text-[15px]">
              Prohlížeč nepotvrdil trvalé uložení dat. Při nedostatku místa by mohl smazat tržby, které ještě nedošly na server. Přidejte pokladnu na plochu
              (Instalovat aplikaci / Přidat na plochu) a nechte zařízení často online – tržby se pak hned uloží i na serveru.
            </p>
          )}
        </>
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await call<{ deviceId: string; token: string }>("/api/ucet/zarizeni", { method: "POST", json: { ...form, unitId: form.unitId || null } });
              const cfgRes = await fetch("/api/pokladna/config", { headers: { authorization: `Bearer ${r.token}` }, cache: "no-store" });
              const cfg = (await cfgRes.json()) as PosConfig;
              await setMeta("device", {
                token: r.token,
                deviceId: r.deviceId,
                registerId: cfg.device.registerId,
                sequencePrefix: cfg.device.sequencePrefix,
                unitId: cfg.device.unitId,
                registeredAt: new Date().toISOString(),
              } satisfies DeviceCredentials);
              await setMeta("config", cfg);
              await setMeta("counter", 0);
              await deleteMeta("activeStaff");
              setPersist(await requestPersistentStorage());
              setLocal(await getDevice());
              await reload();
            });
          }}
        >
          <input aria-label="Název zařízení" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input aria-label="Označení pokladny" className="input" value={form.registerId} onChange={(e) => setForm({ ...form, registerId: e.target.value })} required maxLength={20} />
          <select aria-label="Výchozí evidenční jednotka" className="input" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary" disabled={busy || !units.length}>
              {busy ? "Registruji…" : "Zaregistrovat toto zařízení"}
            </button>
            {!units.length && <p className="mt-2 text-sm text-muted">Nejdřív přidejte evidenční jednotku.</p>}
            <ErrorText error={error} />
          </div>
        </form>
      )}
      {devices.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-3 text-[15px]">
              <span>
                <strong>{d.registerId}</strong> · {d.name}
                <span className="block text-sm text-muted">{d.lastSeenAt ? `naposledy ${new Date(d.lastSeenAt).toLocaleString("cs-CZ")}` : "zatím nepoužito"}</span>
              </span>
              <button
                type="button"
                className="text-sm text-muted hover:text-danger-600"
                onClick={() =>
                  void run(async () => {
                    if (!confirm(`Odpojit pokladnu ${d.registerId}? Zařízení se přestane synchronizovat.`)) return;
                    await call(`/api/ucet/zarizeni/${d.id}`, { method: "DELETE" });
                    await reload();
                  })
                }
              >
                Odpojit
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ───────────── 7. Obsluha ───────────── */

function StaffSection({ state, reload }: { state: State; reload: () => Promise<void> }) {
  const staff = (state.staff ?? []).filter((s) => s.active);
  const [form, setForm] = useState({ name: "", pin: "" });
  const { busy, error, run } = useAction();
  return (
    <Section id="obsluha" step={7} title="Obsluha a PINy" done={staff.some((s) => s.hasPin)} lead={`Až ${state.limits?.staff ?? 5} uživatelů zdarma. Každý se na pokladně přihlásí svým PINem.`}>
      <ul className="mb-4 divide-y divide-line rounded-2xl border border-line">
        {staff.map((s) => (
          <StaffRow key={s.id} s={s} reload={reload} />
        ))}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await call("/api/ucet/personal", { method: "POST", json: { name: form.name, role: "cashier", pin: form.pin || undefined } });
            setForm({ name: "", pin: "" });
            await reload();
          });
        }}
      >
        <input aria-label="Jméno pokladní" required className="input flex-1" placeholder="Jméno pokladní" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label="PIN" className="input w-32" inputMode="numeric" placeholder="PIN" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
        <button type="submit" className="btn-secondary" disabled={busy}>
          + Přidat
        </button>
      </form>
      <ErrorText error={error} />
    </Section>
  );
}

function StaffRow({ s, reload }: { s: NonNullable<State["staff"]>[number]; reload: () => Promise<void> }) {
  const [pin, setPin] = useState("");
  const { busy, error, run } = useAction();
  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <span className="min-w-0 flex-1">
        <strong>{s.name}</strong> <span className="text-sm text-muted">{s.role === "owner" ? "vlastník" : "pokladní"} · {s.hasPin ? "PIN nastaven" : "bez PINu"}</span>
        {s.role === "owner" && !s.hasPin && (
          <span className="block text-sm text-danger-600">Nastavte vlastníkovi PIN (6–8 číslic) – bez něj nejde schválit vratku.</span>
        )}
        {s.role === "owner" && <span className="block text-xs text-muted">PIN vlastníka se ověřuje online. Pro prodej bez signálu použijte profil pokladní.</span>}
      </span>
      <input aria-label={`Nový PIN pro ${s.name}`} className="input w-28 py-2" inputMode="numeric" placeholder={s.role === "owner" ? "PIN 6–8 číslic" : "nový PIN"} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
      <button type="button" className="btn-secondary px-3 py-2" disabled={busy || pin.length < (s.role === "owner" ? 6 : 4)} onClick={() => void run(async () => (await call(`/api/ucet/personal/${s.id}`, { method: "PATCH", json: { pin } }), setPin(""), await reload()))}>
        Nastavit
      </button>
      {s.role !== "owner" && (
        <button type="button" className="px-2 text-sm text-muted hover:text-danger-600" onClick={() => void run(async () => (await call(`/api/ucet/personal/${s.id}`, { method: "PATCH", json: { active: false } }), await reload()))}>
          Odebrat
        </button>
      )}
      {error && <p className="w-full text-sm text-danger-600">{error}</p>}
    </li>
  );
}

/* ───────────── 8. Katalog ───────────── */

function CatalogSection({ state, reload }: { state: State; reload: () => Promise<void> }) {
  const items = state.catalog ?? [];
  const vatPayer = state.account!.vatPayer;
  const [form, setForm] = useState({ name: "", price: "", vatRate: vatPayer ? 21 : 0 });
  const { busy, error, run } = useAction();
  return (
    <Section id="katalog" step={8} title="Rychlá tlačítka (katalog)" done={items.length > 0} lead="Nejčastější zboží a služby – prodej pak stačí jedním klepnutím.">
      {items.length > 0 && (
        <ul className="mb-4 divide-y divide-line rounded-2xl border border-line">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 p-3 text-[15px]">
              <span>
                {i.name} · <strong>{formatCzk(i.price)}</strong>
                {vatPayer && <span className="text-muted"> · DPH {i.vatRate} %</span>}
              </span>
              <button type="button" className="text-sm text-muted hover:text-danger-600" onClick={() => void run(async () => (await call(`/api/ucet/katalog/${i.id}`, { method: "DELETE" }), await reload()))}>
                Smazat
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const price = Math.round(Number(form.price.replace(",", ".")) * 100);
          void run(async () => {
            if (!Number.isFinite(price) || price <= 0) throw new Error("Zadejte cenu");
            await call("/api/ucet/katalog", { method: "POST", json: { name: form.name, price, vatRate: form.vatRate, sort: items.length } });
            setForm({ ...form, name: "", price: "" });
            await reload();
          });
        }}
      >
        <input aria-label="Název položky" required className="input flex-1" placeholder="např. Střih pánský" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label="Cena v Kč" required className="input w-28" inputMode="decimal" placeholder="Cena Kč" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        {vatPayer && (
          <select aria-label="Sazba DPH" className="input w-24" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}>
            <option value={21}>21 %</option>
            <option value={12}>12 %</option>
            <option value={0}>0 %</option>
          </select>
        )}
        <button type="submit" className="btn-secondary" disabled={busy}>
          + Přidat
        </button>
      </form>
      <ErrorText error={error} />
    </Section>
  );
}

/* ───────────── 9. Export ───────────── */

function ExportSection({ salesCount }: { salesCount: number }) {
  const today = pragueToday();
  const monthStart = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  return (
    <Section id="export" step={9} title="Export pro účetní" lead={`CSV pro Excel i účetní software (zatím ${salesCount} tržeb). Export do Pohody / Money připravujeme (Premium).`}>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="ex-od" className="label">
            Od
          </label>
          <input id="ex-od" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ex-do" className="label">
            Do
          </label>
          <input id="ex-do" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <a href={`/api/ucet/export?od=${from}&do=${to}`} className="btn-secondary">
          Stáhnout CSV
        </a>
      </div>
    </Section>
  );
}

/* ───────────── 10. Uzávěrky a pokladní kniha ───────────── */

interface ClosingDto {
  id: string;
  number: number;
  registerId: string;
  closedAt: string;
  staffName: string | null;
  expectedCash: number;
  countedCash: number;
  difference: number;
  cashOut: number;
  closingCash: number;
  gross: number;
  pending: number;
  note: string | null;
  mode: string;
}

function ClosingsSection() {
  const today = pragueToday();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [list, setList] = useState<ClosingDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    call<{ closings: ClosingDto[] }>(`/api/ucet/uzaverky?od=${from}&do=${to}`)
      .then((d) => alive && setList(d.closings))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Nepodařilo se načíst"));
    return () => {
      alive = false;
    };
  }, [from, to]);

  const fmt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
  const diffTotal = (list ?? []).reduce((a, c) => a + c.difference, 0);

  return (
    <Section
      id="uzaverky"
      step={10}
      title="Uzávěrky a pokladní kniha"
      lead="Denní uzávěrky dělá obsluha v pokladně (Přehled → Denní uzávěrka). Tady je vidíte ze všech pokladen a stáhnete pokladní knihu pro účetní."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="cl-od" className="label">
            Od
          </label>
          <input id="cl-od" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cl-do" className="label">
            Do
          </label>
          <input id="cl-do" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <a href={`/api/ucet/uzaverky?od=${from}&do=${to}&format=csv`} className="btn-secondary">
          Pokladní kniha (CSV)
        </a>
      </div>
      <ErrorText error={error} />
      {list && list.length === 0 && <p className="mt-4 text-ink-soft">V tomto období zatím žádná uzávěrka není.</p>}
      {list && list.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th className="py-2 font-medium">Uzávěrka</th>
                <th className="py-2 font-medium">Pokladna</th>
                <th className="py-2 text-right font-medium">Tržby</th>
                <th className="py-2 text-right font-medium">Má být</th>
                <th className="py-2 text-right font-medium">Spočítáno</th>
                <th className="py-2 text-right font-medium">Rozdíl</th>
                <th className="py-2 text-right font-medium">Zůstatek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((c) => (
                <tr key={c.id} title={c.note ?? undefined}>
                  <td className="py-2">
                    č. {c.number} · {fmt.format(new Date(c.closedAt))}
                    {c.staffName && <span className="block text-sm text-muted">{c.staffName}</span>}
                    {c.mode !== "production" && <span className="chip mt-1 bg-surface-2 text-ink-soft">test</span>}
                  </td>
                  <td className="py-2">{c.registerId}</td>
                  <td className="py-2 text-right tabular-nums">{formatCzk(c.gross)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCzk(c.expectedCash)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCzk(c.countedCash)}</td>
                  <td className={`py-2 text-right font-semibold tabular-nums ${c.difference < 0 ? "text-danger-600" : c.difference > 0 ? "text-warn-700" : "text-brand-700"}`}>
                    {c.difference === 0 ? "0" : `${c.difference > 0 ? "+" : ""}${formatCzk(c.difference)}`}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCzk(c.closingCash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-muted">
            Součet rozdílů za období: <strong className={diffTotal < 0 ? "text-danger-600" : "text-ink"}>{formatCzk(diffTotal)}</strong>. Pokladní kniha je podklad pro účetní – tržby
            v hotovosti v ní jsou souhrnně za každou uzávěrku.
          </p>
        </div>
      )}
    </Section>
  );
}

/* ───────────── Účetní s přístupem a zrušení účtu ───────────── */

function AccountantsSection({ state, reload }: { state: State; reload: () => Promise<void> }) {
  const list = state.accountants ?? [];
  const { busy, error, run } = useAction();
  if (!list.length) return null;
  return (
    <section id="ucetni" className="scroll-mt-24 rounded-3xl border border-line bg-white p-6">
      <h2 className="text-xl font-bold">Účetní s přístupem</h2>
      <p className="mt-1 text-[15px] text-ink-soft">Tyto účetní vidí stav vaší připravenosti na EET a mohou stáhnout export tržeb.</p>
      <ul className="mt-4 divide-y divide-line">
        {list.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-3">
            <span className="font-semibold">{a.name}</span>
            <button
              type="button"
              className="btn-ghost py-1.5 text-sm"
              disabled={busy}
              onClick={() => window.confirm(`Zrušit propojení s „${a.name}“? Účetní ztratí přístup k vašim tržbám.`) && void run(async () => {
                await call(`/api/ucet/ucetni/${a.id}`, { method: "DELETE" });
                await reload();
              })}
            >
              Zrušit propojení
            </button>
          </li>
        ))}
      </ul>
      <ErrorText error={error} />
    </section>
  );
}

function CloseAccountSection({ reload }: { reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { busy, error, run } = useAction();
  return (
    <section id="zrusit-ucet" className="scroll-mt-24 rounded-3xl border border-line bg-white p-6">
      <h2 className="text-xl font-bold">Zrušit účet</h2>
      <p className="mt-1 text-[15px] text-ink-soft">
        Pokladní certifikáty přestanou okamžitě fungovat a pokladny přestanou prodávat (uložené tržby ještě odešlou). Na export dat máte 30 dnů, potom data smažeme. Certifikát nezapomeňte zneplatnit v DIS+.
      </p>
      {!open ? (
        <button type="button" className="btn-ghost mt-3 text-danger-600" onClick={() => setOpen(true)}>
          Chci zrušit účet
        </button>
      ) : (
        <form
          className="mt-3 flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              try {
                await call("/api/ucet/zrusit", { method: "POST", json: { confirm: text.trim() } });
              } catch (e) {
                // neodeslané tržby nebo karanténa → seznam a výslovné potvrzení (R5.8)
                if (!(e instanceof ApiError && e.status === 409)) throw e;
                const d = e.data as { pending?: { mode: string; count: number; oldest: string }[]; quarantine?: number; devices?: { name: string; lastSeenAt: string | null }[] };
                const lines = [
                  ...(d.pending ?? []).map((p) => `• ${p.count}× neodeslaná tržba v režimu ${MODE_LABEL[p.mode] ?? p.mode} (nejstarší ${new Date(p.oldest).toLocaleString("cs-CZ")})`),
                  ...(d.quarantine ? [`• ${d.quarantine}× tržba čeká na vaše rozhodnutí`] : []),
                  ...(d.devices ?? []).map((x) => `• pokladna ${x.name}: naposledy online ${x.lastSeenAt ? new Date(x.lastSeenAt).toLocaleString("cs-CZ") : "nikdy"}`),
                ].join("\n");
                const ok = window.confirm(`${e.message}\n\n${lines}\n\nTyto tržby se po zrušení Finanční správě neodešlou – evidujte je jinak (např. MOJE eet). Opravdu zrušit účet?`);
                if (!ok) return;
                await call("/api/ucet/zrusit", { method: "POST", json: { confirm: text.trim(), acknowledgeUnsent: true } });
              }
              await reload();
            });
          }}
        >
          <input aria-label="Pro potvrzení napište ZRUSIT" className="input max-w-[12rem]" placeholder="napište ZRUSIT" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="btn-secondary text-danger-600" disabled={busy || text.trim() !== "ZRUSIT"}>
            Zrušit účet
          </button>
        </form>
      )}
      <ErrorText error={error} />
    </section>
  );
}

/* ───────────── Odmítnuté a zablokované tržby ───────────── */

interface AttentionDto {
  id: string;
  status: string;
  blockedReason: string | null;
  reason: string;
  detail: string | null;
  sequence: string;
  registerId: string;
  soldAt: string;
  total: number;
  mode: string;
  deadlineAt: string;
  correctable?: boolean;
}

interface WarnedDto {
  id: string;
  sequence: string;
  registerId: string;
  soldAt: string;
  total: number;
  mode: string;
  warnings: { code: number; text: string }[];
}

function FailedSalesSection() {
  const [items, setItems] = useState<AttentionDto[] | null>(null);
  const [warned, setWarned] = useState<WarnedDto[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const load = () =>
    call<{ items: AttentionDto[]; warnings?: WarnedDto[] }>("/api/ucet/trzby-k-vyrizeni").then((d) => {
      setItems(d.items);
      setWarned(d.warnings ?? []);
    });
  useEffect(() => {
    void load().catch(() => setItems([]));
  }, []);
  if (!items || (items.length === 0 && warned.length === 0)) return null;
  if (items.length === 0) return <FsWarnings items={warned} />;
  const resend = (ids: string[], action: "resend" | "rebuild" = "resend") =>
    void run(async () => {
      const r = await call<{ requeued: number; confirmed: number; skipped?: { reason: string }[] }>("/api/ucet/trzby-k-vyrizeni", { method: "POST", json: { ids, action } });
      setResult(`Znovu ve frontě: ${r.requeued}, potvrzeno hned: ${r.confirmed}.${r.skipped?.length ? ` ${r.skipped[0]!.reason}` : ""}`);
      await load();
    });
  const fmt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
  return (
    <section id="odmitnute-trzby" className="scroll-mt-24 rounded-3xl border-2 border-danger-600 bg-white p-6">
      <h2 className="text-xl font-bold text-danger-600">Neodeslané tržby ({items.length})</h2>
      <p className="mt-1 text-[15px] text-ink-soft">
        Tržby jsou uložené. Finanční správa je odmítla, nebo je nemůžeme odeslat (certifikát, EIČ). Po opravě je odešlete znovu – lhůta je 48 hodin od prodeje.
      </p>
      <button type="button" className="btn-primary mt-3 py-2 text-sm" disabled={busy} onClick={() => resend(items.map((i) => i.id))}>
        Odeslat znovu vše
      </button>
      {result && <p className="mt-2 text-sm text-muted">{result}</p>}
      <ul className="mt-4 divide-y divide-line">
        {items.map((q) => (
          <li key={q.id} className="py-3">
            <p className="font-semibold">
              {fmt.format(new Date(q.soldAt))} · {formatCzk(q.total)} · {q.registerId}/{q.sequence}
              {q.mode !== "production" && <span className="chip ml-2 bg-surface-2 text-ink-soft">{MODE_LABEL[q.mode] ?? q.mode}</span>}
            </p>
            <p className="text-[15px] text-danger-600">{q.reason}</p>
            {q.detail && <p className="text-sm text-muted">{q.detail}</p>}
            <p className="text-sm text-muted">Lhůta do {fmt.format(new Date(q.deadlineAt))}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary py-1.5 text-sm" disabled={busy} onClick={() => resend([q.id])}>
                Odeslat znovu
              </button>
              {q.correctable && (
                <button
                  type="button"
                  className="btn-secondary py-1.5 text-sm"
                  disabled={busy}
                  onClick={() =>
                    window.confirm("Tržba se odešle s EIČ a číslem evidenční jednotky, které máte teď v nastavení. Pořadové číslo, čas i částka zůstanou. Pokračovat?") &&
                    resend([q.id], "rebuild")
                  }
                >
                  Odeslat s opravenými údaji
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ErrorText error={error} />
      {warned.length > 0 && <FsWarnings items={warned} />}
    </section>
  );
}

/** Upozornění Finanční správy (Varovani) k přijatým tržbám – tržba má POK, ale FS hlásí nesoulad (A Дрібне 15). */
function FsWarnings({ items }: { items: WarnedDto[] }) {
  const fmt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
  return (
    <section className="mt-6 rounded-3xl border border-line bg-white p-6">
      <h2 className="text-lg font-bold">Upozornění Finanční správy ({items.length})</h2>
      <p className="mt-1 text-[15px] text-ink-soft">Tyto tržby Finanční správa přijala, ale připojila k nim upozornění. Zkontrolujte údaje (EIČ, čas v pokladně), ať se to neopakuje.</p>
      <ul className="mt-3 divide-y divide-line">
        {items.map((w) => (
          <li key={w.id} className="py-2 text-[15px]">
            <p className="font-semibold">
              {fmt.format(new Date(w.soldAt))} · {formatCzk(w.total)} · {w.registerId}/{w.sequence}
              {w.mode !== "production" && <span className="chip ml-2 bg-surface-2 text-ink-soft">{MODE_LABEL[w.mode] ?? w.mode}</span>}
            </p>
            {w.warnings.map((x, i) => (
              <p key={i} className="text-sm text-warn-700">
                {x.text} (kód {x.code})
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────────── Problémové tržby (karanténa) ───────────── */

interface QuarantineDto {
  id: string;
  reasonCode: string;
  reason: string;
  detail: string;
  sequence: string | null;
  soldAt: string | null;
  total: number;
  mode: string | null;
  canSendCurrent?: boolean;
  sendRefused?: string | null;
  receivedAt: string;
}

function ProblemSalesSection() {
  const [items, setItems] = useState<QuarantineDto[] | null>(null);
  const [currentMode, setCurrentMode] = useState<string>("mock");
  const { busy, error, run } = useAction();
  const load = () =>
    call<{ items: QuarantineDto[]; accountMode?: string }>("/api/ucet/karantena").then((d) => {
      setItems(d.items);
      if (d.accountMode) setCurrentMode(d.accountMode);
    });
  useEffect(() => {
    void load().catch(() => setItems([]));
  }, []);
  if (!items || items.length === 0) return null;
  const act = (id: string, action: string, note?: string) =>
    void run(async () => {
      const r = await call<{ ok: boolean; result?: { error?: string } }>(`/api/ucet/karantena/${id}`, { method: "POST", json: { action, note } });
      if (!r.ok) throw new Error(r.result?.error ?? "Tržbu se nepodařilo přijmout.");
      await load();
    });
  const fmt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
  return (
    <section id="problemove-trzby" className="scroll-mt-24 rounded-3xl border-2 border-danger-600 bg-white p-6">
      <h2 className="text-xl font-bold text-danger-600">Tržby k vyřízení ({items.length})</h2>
      <p className="mt-1 text-[15px] text-ink-soft">
        Tyto tržby pokladna poslala, ale nemohli jsme je přijmout. Jsou uložené a neztratí se – dokud je nevyřídíte, Finanční správě se neodešlou.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {items.map((q) => (
          <li key={q.id} className="py-3">
            <p className="font-semibold">
              {q.soldAt ? fmt.format(new Date(q.soldAt)) : "—"} · {formatCzk(q.total)} · {q.sequence ?? "bez čísla"}
              {q.mode && q.mode !== "production" && <span className="chip ml-2 bg-surface-2 text-ink-soft">{MODE_LABEL[q.mode] ?? q.mode}</span>}
            </p>
            <p className="text-[15px] text-danger-600">{q.reason}</p>
            {q.detail !== q.reason && <p className="text-sm text-muted">{q.detail}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {q.reasonCode === "MODE_MISMATCH" ? (
                <>
                  {q.canSendCurrent ? (
                    <button
                      type="button"
                      className="btn-primary py-1.5 text-sm"
                      disabled={busy}
                      onClick={() =>
                        window.confirm(`Tržba byla skutečná a odešle se v režimu ${MODE_LABEL[currentMode] ?? currentMode}. Pokračovat?`) && act(q.id, "send_current_mode")
                      }
                    >
                      Odeslat v režimu {MODE_LABEL[currentMode] ?? currentMode}
                    </button>
                  ) : (
                    // tržbu z ostrého provozu nelze poslat do testu ani simulace (R6.1)
                    <p className="w-full text-sm text-ink-soft">{q.sendRefused}</p>
                  )}
                  <button
                    type="button"
                    className="btn-secondary py-1.5 text-sm"
                    disabled={busy}
                    onClick={() => window.confirm("Tržba byla jen zkouška a nebude se evidovat. Záznam zůstane uložený. Pokračovat?") && act(q.id, "was_test")}
                  >
                    Byla to zkouška
                  </button>
                </>
              ) : (
                <button type="button" className="btn-secondary py-1.5 text-sm" disabled={busy} onClick={() => act(q.id, "retry")}>
                  Zkusit znovu přijmout
                </button>
              )}
              {q.reasonCode === "FUTURE_DATE" && (
                <button
                  type="button"
                  className="btn-secondary py-1.5 text-sm"
                  disabled={busy}
                  onClick={() => window.confirm(`Použít jako čas tržby okamžik, kdy ji server přijal (${fmt.format(new Date(q.receivedAt))})?`) && act(q.id, "retry_with_received_time")}
                >
                  Použít čas přijetí
                </button>
              )}
              <button
                type="button"
                className="btn-ghost py-1.5 text-sm"
                disabled={busy}
                onClick={() => {
                  const note = window.prompt("Jak jste tržbu vyřídili? (např. evidována ručně, duplicitní)");
                  if (note?.trim()) act(q.id, "dismiss", note.trim());
                }}
              >
                Vyřízeno ručně
              </button>
            </div>
          </li>
        ))}
      </ul>
      <ErrorText error={error} />
    </section>
  );
}
