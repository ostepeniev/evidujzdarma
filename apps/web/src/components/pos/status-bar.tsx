"use client";

import { useEffect, useState } from "react";
import { deadlineFor, formatRemaining, urgency } from "@ez/fiscal-core";
import { getMeta, rejectedSales, unsettledSales } from "@/lib/pos/db";
import { lastSync, onSyncChange, syncNow } from "@/lib/pos/sync";
import type { PosConfig } from "@/lib/pos/types";
import { ModeBadge } from "./ui";

export function StatusBar({
  config,
  staffName,
  unitId,
  onUnit,
  onLock,
  view,
  onView,
}: {
  config: PosConfig;
  staffName: string | null;
  unitId: string;
  onUnit: (id: string) => void;
  onLock: (() => void) | null;
  view: string;
  onView: (v: "register" | "history" | "summary") => void;
}) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<{ n: number; oldest: string | null }>({ n: 0, oldest: null });
  const [rejected, setRejected] = useState(0);
  const [clockSkewMin, setClockSkewMin] = useState(0);

  useEffect(() => {
    const refresh = async () => {
      const list = await unsettledSales();
      setPending({ n: list.length, oldest: list[0]?.soldAt ?? null });
      setRejected((await rejectedSales()).length);
      const off = await getMeta<{ ms: number; at: number }>("clockOffset");
      setClockSkewMin(off && Date.now() - off.at < 86_400_000 ? Math.round(off.ms / 60_000) : 0);
      setOnline(navigator.onLine && lastSync().online);
    };
    void refresh();
    const off = onSyncChange(() => void refresh());
    const net = () => setOnline(navigator.onLine);
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    const t = setInterval(refresh, 30_000);
    return () => {
      off();
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
      clearInterval(t);
    };
  }, []);

  const deadline = pending.oldest ? deadlineFor(pending.oldest) : null;
  const urg = deadline ? urgency(deadline) : "ok";
  const units = config.units.filter((u) => u.active);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{config.account.name}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <ModeBadge mode={config.account.mode} />
            {units.length > 1 ? (
              <select aria-label="Evidenční jednotka" value={unitId} onChange={(e) => onUnit(e.target.value)} className="rounded-md border border-line bg-white px-1 py-0.5 text-xs">
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            ) : (
              <span>{units[0]?.label}</span>
            )}
            <span>· pokladna {config.device.registerId}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void syncNow()}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
            !online ? "bg-surface-2 text-ink" : pending.n ? (urg === "critical" || urg === "overdue" ? "bg-danger-50 text-danger-600" : "bg-sun-100 text-warn-700") : "bg-brand-50 text-brand-700"
          }`}
          title="Synchronizovat"
        >
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${online ? "bg-brand-500" : "bg-muted"}`} />
          {!online ? "Offline" : "Online"}
          {pending.n > 0 && deadline && (
            <span>
              · {pending.n} čeká ({urg === "overdue" ? "lhůta uplynula" : formatRemaining(deadline)})
            </span>
          )}
        </button>
        {rejected > 0 && (
          <button type="button" onClick={() => onView("history")} className="rounded-full bg-danger-50 px-3 py-1.5 text-sm font-semibold text-danger-600" title="Otevřít historii">
            {rejected} odmítnuto
          </button>
        )}
        <nav className="flex gap-1" aria-label="Pokladna">
          {(
            [
              ["register", "Prodej"],
              ["history", "Historie"],
              ["summary", "Přehled"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" onClick={() => onView(v)} aria-current={view === v ? "page" : undefined} className={`rounded-full px-3 py-1.5 text-sm font-medium ${view === v ? "bg-ink text-white" : "text-ink-soft hover:bg-surface"}`}>
              {l}
            </button>
          ))}
          <a href="/pokladna/nastaveni" className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface">
            Nastavení
          </a>
        </nav>
        {staffName && (
          <span className="flex items-center gap-1 text-sm text-ink-soft">
            {staffName}
            {onLock && (
              <button type="button" onClick={onLock} className="rounded-full px-2 py-1 hover:bg-surface" aria-label="Zamknout pokladnu" title="Zamknout">
                🔒
              </button>
            )}
          </span>
        )}
      </div>
      {Math.abs(clockSkewMin) >= 2 && (
        <p role="alert" className="bg-sun-100 px-4 py-1.5 text-center text-sm text-warn-700">
          Hodiny v zařízení se liší od skutečného času o {Math.abs(clockSkewMin)} min. Čas tržeb opravujeme podle serveru – nastavte prosím v zařízení automatický čas.
        </p>
      )}
    </header>
  );
}
