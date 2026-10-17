"use client";

import { useEffect, useState } from "react";
import { formatCzDate } from "@/lib/doc-tools";
import { B2B_LONG_DUE_DAYS, HOLIDAY_YEARS, dueDate } from "@/lib/due-date";
import { pragueToday } from "@/lib/prague-time";

const PRESETS = [7, 14, 21, 30, 60] as const;

/** S2 B1: datum vystavení + počet dní → splatnost, den v týdnu, víkend/svátek a nejbližší pracovní den. */
export function DueDateCalculator() {
  const [issued, setIssued] = useState("");
  const [days, setDays] = useState("14");
  // dnešní datum až v prohlížeči – server by mohl mít jiný den než návštěvník (hydratace)
  useEffect(() => {
    setIssued((v) => v || pragueToday());
  }, []);

  const n = Number(days);
  const r = issued && days.trim() !== "" ? dueDate(issued, n) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form className="card space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="dd-issued" className="label">
            Datum vystavení faktury
          </label>
          <input id="dd-issued" type="date" className="input" value={issued} onChange={(e) => setIssued(e.target.value)} />
          <p className="mt-1 text-sm text-muted">Nebo jiný den, od kterého se splatnost počítá (třeba doručení faktury).</p>
        </div>
        <div>
          <label htmlFor="dd-days" className="label">
            Splatnost (dní)
          </label>
          <input
            id="dd-days"
            type="number"
            inputMode="numeric"
            min={0}
            max={3650}
            step={1}
            className="input"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Obvyklé splatnosti">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={n === p}
                onClick={() => setDays(String(p))}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${n === p ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-surface"}`}
              >
                {p} dní
              </button>
            ))}
          </div>
        </div>
      </form>

      <div aria-live="polite" className="space-y-4">
        {!r ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">Zadejte datum vystavení a počet dní.</div>
        ) : !r.ok ? (
          <div role="alert" className="rounded-2xl bg-danger-50 p-6 text-danger-600">
            {r.error === "date" ? "Zadejte platné datum." : "Počet dní zadejte jako celé číslo od 0 do 3650."}
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Datum splatnosti</p>
            <p className="text-3xl font-extrabold text-ink">
              {formatCzDate(r.due)} <span className="text-xl font-semibold text-ink-soft">({r.weekday})</span>
            </p>
            <p className="text-ink-soft">
              {formatCzDate(issued)} + {n} {n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní"}. Lhůta počíná dnem, který následuje po dni vystavení (§ 605 občanského zákoníku).
            </p>
            {(r.weekend || r.holiday) && (
              <div className="rounded-xl bg-white p-4 text-ink">
                <p>
                  Splatnost připadá na {r.holiday ? `svátek (${r.holiday})` : r.weekday === "sobota" ? "sobotu" : "neděli"}. Nejbližší pracovní den:{" "}
                  <strong>
                    {formatCzDate(r.nextWorking)} ({r.nextWorkingWeekday})
                  </strong>
                  .
                </p>
                <p className="mt-2 text-sm text-ink-soft">
                  U lhůt platí § 607 občanského zákoníku: připadne-li poslední den lhůty na sobotu, neděli nebo svátek, je posledním dnem pracovní den
                  nejblíže následující. Pro sjednanou splatnost faktury to zákon výslovně neuvádí – chcete-li jistotu, napište na fakturu konkrétní datum.
                </p>
              </div>
            )}
            {r.holidaysUnknown && (
              <p className="text-sm text-ink-soft">
                Svátky kontrolujeme pro roky {HOLIDAY_YEARS.from}–{HOLIDAY_YEARS.to}; u tohoto data jsme ověřili jen víkend.
              </p>
            )}
            {r.longB2b && (
              <p className="rounded-xl bg-white p-4 text-[15px] text-ink">
                Mezi podnikateli smí splatnost přesáhnout {B2B_LONG_DUE_DAYS} dní jen tehdy, je-li to výslovně ujednáno a není-li to pro věřitele
                zvláště nevýhodné (§ 1963 odst. 2 občanského zákoníku).
              </p>
            )}
            <a href={`/kalkulacka-urok-z-prodleni#splatnost=${r.due}`} className="btn-secondary">
              Nezaplatil včas? Spočítat úrok z prodlení
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
