"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { formatCzk } from "@ez/fiscal-core";
import { getDevice, setMeta, deleteMeta } from "@/lib/pos/db";
import type { DeviceCredentials, PosConfig } from "@/lib/pos/types";
import { call, UNIT_TYPE_LABEL, type AccountStateDto } from "./api";

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

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-3 rounded-xl bg-danger-50 p-3 text-[15px] text-danger-600">
      {error}
    </p>
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
      setError(e instanceof Error ? e.message : "Něco se nepovedlo");
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
    ownerName: "",
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
  const [environment, setEnvironment] = useState<"production" | "playground">("production");
  const { busy, error, run } = useAction();
  return (
    <Section
      id="certifikat"
      step={4}
      title="Pokladní certifikát"
      done={certs.some((c) => c.environment === "production")}
      lead="Certifikát (.p12) vygenerujete zdarma v DIS+. Privátní klíč ukládáme šifrovaně na serverech v EU a dešifrujeme ho jen v paměti při odeslání tržby."
    >
      {certs.length > 0 && (
        <ul className="mb-4 space-y-2">
          {certs.map((c) => (
            <li key={c.id} className="rounded-2xl bg-surface p-3 text-[15px]">
              <strong>{c.environment === "production" ? "Ostrý certifikát" : "Testovací (Playground)"}</strong> · EIČ {c.eic ?? "—"} · platný do {new Date(c.validTo).toLocaleDateString("cs-CZ")}
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("environment", environment);
          const formEl = e.currentTarget;
          void run(async () => {
            const res = await fetch("/api/ucet/certifikat", { method: "POST", body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Nahrání se nezdařilo");
            formEl.reset();
            await reload();
          });
        }}
      >
        <input aria-label="Soubor certifikátu" name="file" type="file" accept=".p12,.pfx,application/x-pkcs12" required className="input py-2 sm:col-span-2" />
        <input aria-label="Heslo k certifikátu" name="password" type="password" autoComplete="off" className="input" placeholder="Heslo k certifikátu" />
        <select aria-label="Prostředí" className="input" value={environment} onChange={(e) => setEnvironment(e.target.value as "production" | "playground")}>
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
              onClick={() => void run(async () => (await call("/api/ucet/rezim", { method: "POST", json: { mode: m.v } }), await reload()))}
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
                const r = await call<{ ok: boolean; mode: string; message?: string; code?: string }>("/api/ucet/overeni", { method: "POST", json: { unitId: units[0]!.id } });
                setResult(
                  r.ok
                    ? r.mode === "mock"
                      ? "Ukázkový režim: testovací tržba proběhla (bez odeslání do FS)."
                      : "Finanční správa ověřovací zprávu přijala – certifikát, EIČ i číslo jednotky jsou v pořádku."
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

  return (
    <Section id="zarizeni" step={6} title="Toto zařízení jako pokladna" done={!!thisDevice} lead="Zařízení dostane vlastní klíč – pokladní se pak přihlašují jen PINem, i bez internetu.">
      {thisDevice ? (
        <p className="rounded-2xl bg-brand-50 p-4 text-[15px]">
          Toto zařízení je pokladna <strong>{thisDevice.registerId}</strong> ({thisDevice.name}).{" "}
          <Link href="/pokladna" className="font-semibold text-brand-700 underline">
            Otevřít pokladnu →
          </Link>
        </p>
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
      </span>
      <input aria-label={`Nový PIN pro ${s.name}`} className="input w-28 py-2" inputMode="numeric" placeholder="nový PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
      <button type="button" className="btn-secondary px-3 py-2" disabled={busy || pin.length < 4} onClick={() => void run(async () => (await call(`/api/ucet/personal/${s.id}`, { method: "PATCH", json: { pin } }), setPin(""), await reload()))}>
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
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  return (
    <Section id="export" step={9} title="Export pro účetní" lead={`CSV pro Excel i účetní software (zatím ${salesCount} tržeb). Export do Pohody / Money bude v Premium.`}>
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
