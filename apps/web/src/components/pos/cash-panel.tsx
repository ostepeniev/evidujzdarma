"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CASH_MOVEMENT_LABEL, CZK_DENOMINATIONS, PAYMENT_LABEL, PAYMENT_METHODS, renderClosingText, sumDenominations, type ClosingTotals } from "@ez/fiscal-core";
import { cashSnapshot, closingTotals, recordClosing, recordMovement, type CashSnapshot } from "@/lib/pos/cash";
import { listClosings, movementsSince } from "@/lib/pos/db";
import { bluetoothSupported, printEscPos } from "@/lib/pos/escpos";
import { onSyncChange } from "@/lib/pos/sync";
import type { LocalCashMovement, LocalClosing, PosConfig } from "@/lib/pos/types";
import { Sheet, kc, parseKc } from "./ui";

interface Staff {
  id: string;
  name: string;
}

const timeFmt = new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

/** Okamžik „teď“, ale vždy po začátku období (těsně po uzávěrce by výpočet odmítl prázdné období). */
function nowAfter(periodFrom: string): string {
  return new Date(Math.max(Date.now(), Date.parse(periodFrom) + 1)).toISOString();
}

function unitLabelOf(config: PosConfig): string | null {
  return config.units.find((u) => u.id === config.device.unitId)?.label ?? null;
}

export function closingText(config: PosConfig, c: LocalClosing, movements: readonly LocalCashMovement[] = [], width = 42): string {
  return renderClosingText(
    {
      number: c.number,
      merchantName: config.account.name,
      registerId: config.device.registerId,
      unitLabel: c.unitLabel,
      staffName: c.staffName,
      periodFrom: c.periodFrom,
      closedAt: c.closedAt,
      totals: c.totals,
      movements: movements.filter((m) => (!c.periodFrom || m.at > c.periodFrom) && m.at <= c.closedAt),
      note: c.note,
      mode: c.mode === "production" ? "production" : "test",
    },
    width,
  );
}

export function CashPanel({ config, staff }: { config: PosConfig; staff: Staff | null }) {
  const [snap, setSnap] = useState<CashSnapshot | null>(null);
  const [closings, setClosings] = useState<LocalClosing[]>([]);
  const [sheet, setSheet] = useState<null | { kind: "deposit" | "withdrawal" } | { kind: "closing" } | { kind: "report"; closing: LocalClosing; movements: LocalCashMovement[] }>(null);

  const load = useCallback(async () => {
    const [s, list] = await Promise.all([cashSnapshot(config), listClosings(5)]);
    setSnap(s);
    setClosings(list);
  }, [config]);

  useEffect(() => {
    void load();
    return onSyncChange(() => void load());
  }, [load]);

  const live = useMemo(() => {
    if (!snap) return null;
    return closingTotals(snap, { closedAt: nowAfter(snap.period.periodFrom), openingCash: snap.period.openingCash ?? 0, countedCash: 0, cashOut: 0 });
  }, [snap]);

  if (!snap || !live) return null;
  const first = snap.period.openingCash === null;

  return (
    <section className="rounded-3xl border border-line bg-white p-6" aria-labelledby="cash-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="cash-h" className="text-sm text-muted">
            Hotovost v pokladně (očekáváno)
          </h2>
          <p className="text-4xl font-extrabold tabular-nums">{kc(live.expectedCash)}</p>
          <p className="mt-1 text-sm text-muted">
            {snap.period.lastClosing
              ? `Od uzávěrky č. ${snap.period.lastClosing.number} (${dateTimeFmt.format(new Date(snap.period.lastClosing.closedAt))})`
              : "Uzávěrku jste ještě nedělali – počítáme od dnešní půlnoci, počáteční stav zadáte při uzávěrce."}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setSheet({ kind: "closing" })}>
          Denní uzávěrka
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-[15px] sm:grid-cols-4">
        <div className="rounded-2xl bg-surface p-3">
          <dt className="text-muted">Počáteční stav</dt>
          <dd className="font-semibold tabular-nums">{first ? "—" : kc(live.openingCash)}</dd>
        </div>
        <div className="rounded-2xl bg-surface p-3">
          <dt className="text-muted">Tržby hotově</dt>
          <dd className="font-semibold tabular-nums">{kc(live.cashSales)}</dd>
        </div>
        <div className="rounded-2xl bg-surface p-3">
          <dt className="text-muted">Vklady</dt>
          <dd className="font-semibold tabular-nums">{kc(live.deposits)}</dd>
        </div>
        <div className="rounded-2xl bg-surface p-3">
          <dt className="text-muted">Výběry</dt>
          <dd className="font-semibold tabular-nums">{kc(live.withdrawals)}</dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={() => setSheet({ kind: "deposit" })}>
          + Vklad
        </button>
        <button type="button" className="btn-secondary" onClick={() => setSheet({ kind: "withdrawal" })}>
          − Výběr
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Vklad a výběr hotovosti nejsou tržby – Finanční správě se neposílají.</p>

      {snap.movements.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line text-[15px]">
          {snap.movements.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-2">
              <span className="w-12 tabular-nums text-muted">{timeFmt.format(new Date(m.at))}</span>
              <span className="min-w-0 flex-1 truncate">
                {CASH_MOVEMENT_LABEL[m.type]}
                {m.note ? ` – ${m.note}` : ""}
                {m.staffName ? <span className="text-muted"> · {m.staffName}</span> : null}
              </span>
              <span className={`font-semibold tabular-nums ${m.type === "withdrawal" ? "text-danger-600" : ""}`}>
                {m.type === "withdrawal" ? "−" : "+"}
                {kc(m.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {closings.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Poslední uzávěrky</h3>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line text-[15px]">
            {closings.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface"
                  onClick={async () => setSheet({ kind: "report", closing: c, movements: await movementsSince(c.periodFrom) })}
                >
                  <span className="flex-1">
                    č. {c.number} · {dateTimeFmt.format(new Date(c.closedAt))}
                    {c.staffName ? <span className="text-muted"> · {c.staffName}</span> : null}
                  </span>
                  <DifferenceChip value={c.totals.difference} />
                  {!c.syncedAt && <span className="chip bg-sun-100 text-warn-700">neodesláno</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet?.kind === "deposit" || sheet?.kind === "withdrawal" ? (
        <MovementSheet
          type={sheet.kind}
          staff={staff}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            void load();
          }}
        />
      ) : null}
      {sheet?.kind === "closing" && (
        <ClosingSheet
          config={config}
          snap={snap}
          staff={staff}
          onClose={() => setSheet(null)}
          onSaved={(closing, movements) => {
            setSheet({ kind: "report", closing, movements });
            void load();
          }}
        />
      )}
      {sheet?.kind === "report" && <ReportSheet config={config} closing={sheet.closing} movements={sheet.movements} onClose={() => setSheet(null)} />}
    </section>
  );
}

function DifferenceChip({ value }: { value: number }) {
  if (value === 0) return <span className="chip bg-brand-100 text-brand-700">sedí</span>;
  return value < 0 ? <span className="chip bg-danger-50 text-danger-600">manko {kc(value)}</span> : <span className="chip bg-sun-100 text-warn-700">přebytek +{kc(value)}</span>;
}

const NOTE_PRESETS: Record<"deposit" | "withdrawal", string[]> = {
  deposit: ["Drobné na vracení", "Vklad majitele"],
  withdrawal: ["Odvod do banky", "Nákup zboží", "Výběr majitele"],
};

function MovementSheet({ type, staff, onClose, onSaved }: { type: "deposit" | "withdrawal"; staff: Staff | null; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={type === "deposit" ? "Vklad hotovosti" : "Výběr hotovosti"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const h = parseKc(amount);
          if (h === null || h <= 0) return setError("Zadejte kladnou částku.");
          setBusy(true);
          try {
            await recordMovement({ type, amount: h, note, staff });
            onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Uložení se nezdařilo");
            setBusy(false);
          }
        }}
      >
        <label htmlFor="mv-amount" className="label">
          Částka (Kč)
        </label>
        <input id="mv-amount" inputMode="decimal" autoFocus className="input text-2xl" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        <label htmlFor="mv-note" className="label mt-4">
          Důvod
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {NOTE_PRESETS[type].map((p) => (
            <button key={p} type="button" className={`rounded-full border px-3 py-1 text-sm ${note === p ? "border-brand-600 bg-brand-50" : "border-line"}`} onClick={() => setNote(p)}>
              {p}
            </button>
          ))}
        </div>
        <input id="mv-note" className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p className="mt-2 text-danger-600">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
          {busy ? "Ukládám…" : type === "deposit" ? "Uložit vklad" : "Uložit výběr"}
        </button>
      </form>
    </Sheet>
  );
}

function ClosingSheet({
  config,
  snap,
  staff,
  onClose,
  onSaved,
}: {
  config: PosConfig;
  snap: CashSnapshot;
  staff: Staff | null;
  onClose: () => void;
  onSaved: (c: LocalClosing, movements: LocalCashMovement[]) => void;
}) {
  const first = snap.period.openingCash === null;
  const [opening, setOpening] = useState(first ? "0" : "");
  const [counted, setCounted] = useState("");
  const [cashOut, setCashOut] = useState("");
  const [note, setNote] = useState("");
  const [useCoins, setUseCoins] = useState(false);
  const [coins, setCoins] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openingH = first ? parseKc(opening || "0") : snap.period.openingCash;
  const countedH = useCoins ? sumDenominations(coins) : parseKc(counted);
  const cashOutH = parseKc(cashOut || "0");

  let preview: ClosingTotals | null = null;
  let previewError: string | null = null;
  try {
    preview = closingTotals(snap, {
      closedAt: nowAfter(snap.period.periodFrom),
      openingCash: openingH ?? 0,
      countedCash: countedH ?? 0,
      cashOut: Math.min(cashOutH ?? 0, countedH ?? 0),
    });
  } catch (e) {
    previewError = e instanceof Error ? e.message : String(e);
  }
  if (!preview) return <Sheet title="Denní uzávěrka" onClose={onClose}><p className="text-danger-600">{previewError}</p></Sheet>;

  const ready = openingH !== null && countedH !== null && cashOutH !== null && cashOutH <= countedH;

  return (
    <Sheet title={`Denní uzávěrka č. ${snap.period.nextNumber}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="rounded-2xl bg-surface p-4 text-[15px]">
          <p className="font-semibold">
            Tržby: {preview.salesCount}
            {preview.refundsCount ? ` · vratky ${preview.refundsCount}` : ""} · celkem {kc(preview.gross)}
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {PAYMENT_METHODS.filter((m) => preview!.byMethod[m] !== 0).map((m) => (
              <li key={m} className="flex justify-between gap-2">
                <span className="text-muted">{PAYMENT_LABEL[m]}</span>
                <span className="tabular-nums">{kc(preview!.byMethod[m])}</span>
              </li>
            ))}
          </ul>
          {preview.pending > 0 && (
            <p className="mt-2 text-warn-700">
              {preview.pending} tržeb ještě čeká na POK. Uzávěrku můžete udělat – tržby se odešlou samy, jakmile bude spojení.
            </p>
          )}
          {preview.rejected > 0 && <p className="mt-1 text-danger-600">{preview.rejected} tržeb bylo odmítnuto – zkontrolujte je v historii.</p>}
        </div>

        {first && (
          <div>
            <label htmlFor="cl-open" className="label">
              Počáteční stav – kolik hotovosti bylo v pokladně ráno
            </label>
            <input id="cl-open" inputMode="decimal" className="input" value={opening} onChange={(e) => setOpening(e.target.value)} />
            <p className="mt-1 text-sm text-muted">Jen u první uzávěrky. Příště ho převezmeme ze zůstatku poslední uzávěrky.</p>
          </div>
        )}

        <table className="w-full text-[15px]">
          <tbody className="divide-y divide-line">
            <tr>
              <th scope="row" className="py-1.5 text-left font-normal text-muted">Počáteční stav</th>
              <td className="py-1.5 text-right tabular-nums">{kc(preview.openingCash)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 text-left font-normal text-muted">+ tržby hotově</th>
              <td className="py-1.5 text-right tabular-nums">{kc(preview.cashSales)}</td>
            </tr>
            {preview.deposits > 0 && (
              <tr>
                <th scope="row" className="py-1.5 text-left font-normal text-muted">+ vklady</th>
                <td className="py-1.5 text-right tabular-nums">{kc(preview.deposits)}</td>
              </tr>
            )}
            {preview.withdrawals > 0 && (
              <tr>
                <th scope="row" className="py-1.5 text-left font-normal text-muted">− výběry</th>
                <td className="py-1.5 text-right tabular-nums">{kc(preview.withdrawals)}</td>
              </tr>
            )}
            <tr>
              <th scope="row" className="py-1.5 text-left font-semibold">= Má být v pokladně</th>
              <td className="py-1.5 text-right text-lg font-bold tabular-nums">{kc(preview.expectedCash)}</td>
            </tr>
          </tbody>
        </table>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="cl-counted" className="label mb-0">
              Spočítaná hotovost
            </label>
            <button type="button" className="text-sm font-medium text-brand-700 underline" onClick={() => setUseCoins((v) => !v)}>
              {useCoins ? "Zadat jednou částkou" : "Spočítat po bankovkách a mincích"}
            </button>
          </div>
          {useCoins ? (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {CZK_DENOMINATIONS.map((d) => (
                <label key={d} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5 text-sm">
                  <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{d.toLocaleString("cs-CZ")}</span>
                  <span className="text-muted">×</span>
                  <input
                    inputMode="numeric"
                    aria-label={`Počet kusů ${d} Kč`}
                    className="w-full min-w-0 rounded-lg border border-line px-2 py-1 text-right"
                    value={coins[String(d)] ?? ""}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                      setCoins((c) => ({ ...c, [String(d)]: Math.min(n, 100_000) }));
                    }}
                  />
                </label>
              ))}
              <p className="col-span-full text-right text-lg font-bold tabular-nums">= {kc(countedH ?? 0)}</p>
            </div>
          ) : (
            <input id="cl-counted" inputMode="decimal" className="input mt-1.5 text-2xl" placeholder="0" value={counted} onChange={(e) => setCounted(e.target.value)} />
          )}
        </div>

        {countedH !== null && (useCoins || counted !== "") && (
          <p
            className={`rounded-2xl px-4 py-3 text-lg font-semibold ${preview.difference === 0 ? "bg-brand-50 text-brand-700" : preview.difference < 0 ? "bg-danger-50 text-danger-600" : "bg-sun-100 text-warn-700"}`}
            aria-live="polite"
          >
            {preview.difference === 0 ? "Sedí na korunu." : preview.difference < 0 ? `Manko ${kc(preview.difference)}` : `Přebytek +${kc(preview.difference)}`}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cl-out" className="label">
              Odvod – vyberu z pokladny
            </label>
            <input id="cl-out" inputMode="decimal" className="input" placeholder="0" value={cashOut} onChange={(e) => setCashOut(e.target.value)} />
            <p className="mt-1 text-sm text-muted">Zůstane v pokladně: {kc(preview.closingCash)}</p>
            {cashOutH !== null && countedH !== null && cashOutH > countedH && <p className="mt-1 text-sm text-danger-600">Odvod je vyšší než spočítaná hotovost.</p>}
          </div>
          <div>
            <label htmlFor="cl-note" className="label">
              Poznámka {preview.difference !== 0 && <span className="font-normal text-muted">(doporučeno při rozdílu)</span>}
            </label>
            <input id="cl-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-danger-600">{error}</p>}
        <button
          type="button"
          className="btn-primary w-full py-4 text-lg"
          disabled={!ready || busy}
          onClick={async () => {
            if (!ready) return;
            setBusy(true);
            setError(null);
            try {
              const closing = await recordClosing(config, snap, {
                openingCash: openingH!,
                countedCash: countedH!,
                cashOut: cashOutH!,
                denominations: useCoins ? Object.fromEntries(Object.entries(coins).filter(([, n]) => n > 0)) : null,
                note,
                staff,
                unitLabel: unitLabelOf(config),
              });
              onSaved(closing, snap.movements);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Uzávěrku se nepodařilo uložit");
              setBusy(false);
            }
          }}
        >
          {busy ? "Ukládám…" : "Uzavřít pokladnu"}
        </button>
        <p className="text-center text-xs text-muted">Uzávěrka se uloží v zařízení a odešle se na server – najdete ji i v nastavení a v pokladní knize pro účetní.</p>
      </div>
    </Sheet>
  );
}

function ReportSheet({ config, closing, movements, onClose }: { config: PosConfig; closing: LocalClosing; movements: LocalCashMovement[]; onClose: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const text = closingText(config, closing, movements);
  return (
    <Sheet title={`Uzávěrka č. ${closing.number}`} onClose={onClose}>
      <pre className="receipt-paper mx-auto w-full max-w-[22rem] overflow-x-auto rounded-2xl border border-line bg-white p-4 font-mono text-[11px] leading-snug text-ink">{text}</pre>
      <div className="no-print mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          Tisk
        </button>
        {bluetoothSupported() ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                await printEscPos(closingText(config, closing, movements, 32), 32);
                setMessage("Vytištěno.");
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Tisk se nezdařil");
              }
            }}
          >
            Bluetooth
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={onClose}>
            Hotovo
          </button>
        )}
      </div>
      {bluetoothSupported() && (
        <button type="button" className="btn-primary no-print mt-2 w-full" onClick={onClose}>
          Hotovo
        </button>
      )}
      {message && <p className="no-print mt-2 text-center text-sm text-ink-soft">{message}</p>}
    </Sheet>
  );
}
