"use client";

import { useEffect, useState } from "react";
import type { Poll } from "@/content/polls";

interface Results {
  total: number;
  percentages: Record<string, number> | null;
  myChoice: string | null;
}

const votesLabel = (n: number) => (n === 1 ? "hlas" : n >= 2 && n <= 4 ? "hlasy" : "hlasů");

export function PollWidget({ poll }: { poll: Poll }) {
  const [res, setRes] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/anketa?poll=${encodeURIComponent(poll.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Results | null) => alive && d && setRes(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [poll.id]);

  async function vote(choice: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/anketa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ poll: poll.id, choice }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Hlas se nepodařilo uložit.");
      setRes(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hlas se nepodařilo uložit.");
    } finally {
      setBusy(false);
    }
  }

  const voted = !!res?.myChoice;
  return (
    <div className="card">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">Anketa</p>
      <h3 className="mt-1 text-2xl font-bold text-ink">{poll.question}</h3>
      <ul className="mt-5 space-y-2" role="list">
        {poll.options.map((o) => {
          const p = res?.percentages?.[o.id];
          const mine = res?.myChoice === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={busy}
                aria-pressed={mine}
                onClick={() => vote(o.id)}
                className={`relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left text-base font-medium transition-colors ${mine ? "border-brand-600" : "border-line hover:bg-surface"}`}
              >
                {voted && p !== undefined && <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-brand-100" style={{ width: `${p}%` }} />}
                <span className="relative flex items-center justify-between gap-3">
                  <span>
                    {o.label}
                    {mine && <span className="ml-2 text-sm font-normal text-brand-700">· váš hlas</span>}
                  </span>
                  {voted && p !== undefined && <span className="tabular-nums text-ink-soft">{p} %</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {error ? (
          <span className="text-danger-600">{error}</span>
        ) : !res ? (
          "Hlasování je anonymní."
        ) : voted && !res.percentages ? (
          `Díky! Zatím ${res.total} ${votesLabel(res.total)}. Výsledky ukážeme od ${poll.minVotesToShow} hlasů.`
        ) : voted ? (
          `Díky! Celkem ${res.total} ${votesLabel(res.total)}. Svůj hlas můžete změnit.`
        ) : (
          "Hlasování je anonymní – neukládáme jméno ani IP adresu. Výsledky zveřejňujeme jen souhrnně."
        )}
      </p>
    </div>
  );
}
