"use client";

import { useEffect, useMemo, useState } from "react";
import { PAYMENT_LABEL, PAYMENT_METHODS, decimalString, type PaymentMethod } from "@ez/fiscal-core";
import { salesSince } from "@/lib/pos/db";
import { unresolvedRejected } from "@/lib/pos/sync-result";
import { onSyncChange } from "@/lib/pos/sync";
import type { LocalSale, PosConfig } from "@/lib/pos/types";
import { CashPanel } from "./cash-panel";
import { StatusChip, kc } from "./ui";

const time = new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" });

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function useSales(sinceDays: number): LocalSale[] {
  const [sales, setSales] = useState<LocalSale[]>([]);
  useEffect(() => {
    const since = new Date(startOfDay().getTime() - sinceDays * 86_400_000).toISOString();
    const load = () => void salesSince(since).then(setSales);
    load();
    return onSyncChange(load);
  }, [sinceDays]);
  return sales;
}

export function HistoryView({ onOpen }: { onOpen: (id: string) => void }) {
  const sales = useSales(7);
  const groups = useMemo(() => {
    const map = new Map<string, LocalSale[]>();
    for (const s of sales) {
      const k = startOfDay(new Date(s.soldAt)).toISOString();
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()];
  }, [sales]);

  if (!sales.length) return <p className="py-16 text-center text-muted">Za posledních 7 dní tu nejsou žádné tržby.</p>;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {groups.map(([k, list]) => (
        <section key={k}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{day.format(new Date(k))}</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {list.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface">
                  <span className="w-12 text-sm tabular-nums text-muted">{time.format(new Date(s.soldAt))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {s.refundOf ? "Vratka · " : ""}
                      {s.lines.map((l) => l.name).join(", ")}
                    </span>
                    <span className="text-xs text-muted">
                      {s.sequence} · {s.payments.map((p) => PAYMENT_LABEL[p.method]).join(", ")}
                      {s.staffName ? ` · ${s.staffName}` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={`block font-semibold tabular-nums ${s.total < 0 ? "text-danger-600" : ""}`}>{kc(s.total)}</span>
                    <StatusChip status={s.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const STATUS_CSV: Record<string, string> = {
  confirmed: "potvrzeno",
  local: "čeká na odeslání",
  queued: "čeká na odeslání",
  sending: "odesílá se",
  failed: "čeká na odeslání",
  rejected: "odmítnuto",
  not_required: "neeviduje se",
};

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function SummaryView({ config, staff }: { config: PosConfig; staff: { id: string; name: string } | null }) {
  const sales = useSales(0);
  // R1.13: odmítnuté tržby se nesmí ztratit z přehledu – peníze se přijaly, jen nejsou v EET
  const today = sales.filter((s) => new Date(s.soldAt) >= startOfDay());
  // vyřízené vlastníkem (R5.7) už nejsou „k vyřízení“, ale v přehledu zůstávají
  const todayRejected = unresolvedRejected(today);
  const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as Record<PaymentMethod, number>;
  for (const s of today) for (const p of s.payments) byMethod[p.method] += p.amount;
  const total = today.reduce((a, s) => a + s.total, 0);
  const tips = today.reduce((a, s) => a + s.tip, 0);
  const refunds = today.filter((s) => s.refundOf);
  const pending = sales.filter((s) => ["local", "queued", "sending", "failed"].includes(s.status));
  const rejected = unresolvedRejected(sales);

  function exportCsv() {
    const head = ["Čas", "Pořadové číslo", "Položky", "Celkem", "Způsob platby", "Spropitné", "Sleva", "POK", "Stav", "Důvod odmítnutí", "Pokladní"];
    const rows = today.map((s) =>
      [
        new Date(s.soldAt).toLocaleString("cs-CZ"),
        s.sequence,
        s.lines.map((l) => `${l.qty}× ${l.name}`).join(", "),
        decimalString(s.total),
        s.payments.map((p) => `${PAYMENT_LABEL[p.method]} ${decimalString(p.amount)}`).join(" + "),
        decimalString(s.tip),
        decimalString(s.discount),
        s.confirmationCode ?? "",
        s.resolution === "dismissed" ? "vyřízeno vlastníkem" : (STATUS_CSV[s.status] ?? s.status),
        s.status === "rejected" ? (s.error ?? "") : "",
        s.staffName ?? "",
      ]
        .map(csvCell)
        .join(";"),
    );
    const blob = new Blob(["﻿" + [head.join(";"), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trzby-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <CashPanel config={config} staff={staff} />
      <div className="rounded-3xl border border-line bg-white p-6">
        <p className="text-sm text-muted">Dnešní tržby ({today.length})</p>
        <p className="text-4xl font-extrabold tabular-nums">{kc(total)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PAYMENT_METHODS.map((m) => (
            <div key={m} className="rounded-2xl bg-surface p-3">
              <dt className="text-sm text-muted">{PAYMENT_LABEL[m]}</dt>
              <dd className="text-lg font-semibold tabular-nums">{kc(byMethod[m])}</dd>
            </div>
          ))}
          <div className="rounded-2xl bg-surface p-3">
            <dt className="text-sm text-muted">Spropitné</dt>
            <dd className="text-lg font-semibold tabular-nums">{kc(tips)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[15px] text-ink-soft">
          Vratky: {refunds.length} ({kc(refunds.reduce((a, s) => a + s.total, 0))})
        </p>
        {todayRejected.length > 0 && (
          <p className="mt-1 text-[15px] font-semibold text-danger-600">
            Z toho odmítnuto: {todayRejected.length} ({kc(todayRejected.reduce((a, s) => a + s.total, 0))}) – nejsou evidované v EET, vyřiďte je v historii nebo v nastavení.
          </p>
        )}
      </div>
      <div className={`rounded-3xl border p-5 ${pending.length ? "border-sun-500 bg-sun-100" : "border-line bg-white"}`}>
        <p className="font-semibold">{pending.length ? `${pending.length} tržeb čeká na potvrzení (POK)` : "Všechny tržby jsou potvrzené."}</p>
        {rejected.length > 0 && <p className="mt-1 text-danger-600">{rejected.length} tržeb bylo odmítnuto – otevřete je v historii.</p>}
      </div>
      <button type="button" className="btn-secondary w-full" onClick={exportCsv} disabled={!today.length}>
        Stáhnout dnešní tržby (CSV)
      </button>
      <p className="text-center text-sm text-muted">Přehled za libovolné období a export pro účetní najdete v nastavení pokladny.</p>
    </div>
  );
}
