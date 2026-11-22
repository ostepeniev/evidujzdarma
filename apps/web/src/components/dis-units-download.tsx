"use client";

import { useState } from "react";

/**
 * S12 (22. 11. 2026): „Stáhnout CSV pro import do DIS+“ – v nastavení pokladny (vlastník) i v Účetním kabinetu (po klientech).
 * Soubor se stáhne, jen když mají všechny jednotky potřebné údaje; jinak ukážeme, co u které jednotky doplnit (422).
 */
export function DisUnitsDownload({ endpoint, label = "Stáhnout CSV pro import do DIS+" }: { endpoint: string; label?: string }) {
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ label: string; problems: string[] }[]>([]);
  const [done, setDone] = useState(false);

  const download = async () => {
    setBusy(true);
    setError(null);
    setProblems([]);
    setDone(false);
    try {
      const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${all ? "vse=1" : ""}`.replace(/[?&]$/, "");
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; units?: { label: string; problems: string[] }[] };
        setError(data.error ?? `Chyba ${res.status}`);
        setProblems(data.units ?? []);
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "dis-jednotky.csv";
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setDone(true);
    } catch {
      setError("Soubor se nepodařilo stáhnout. Zkontrolujte připojení a zkuste to znovu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-export="dis-jednotky">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void download()}>
          {label}
        </button>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />i jednotky s číslem z DIS+
        </label>
      </div>
      {done && <p className="mt-2 text-sm text-brand-700">Soubor je stažený. V DIS+ ho nahrajte v části pro hromadný import evidenčních jednotek.</p>}
      {error && (
        <div role="alert" className="mt-2 text-sm text-danger-600">
          <p>{error}</p>
          {problems.length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {problems.map((p) => (
                <li key={p.label}>
                  <strong>{p.label}:</strong> {p.problems.join(" ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
