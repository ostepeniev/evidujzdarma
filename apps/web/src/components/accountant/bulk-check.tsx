"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { parseIcoList } from "@ez/cz/ico";
import type { Verdict } from "@/lib/eet-assessment";
import { csvCell } from "@/lib/csv";
import {
  BULK_MAX_BATCH,
  BULK_MAX_TOTAL,
  EET_OFF_HINT,
  EET_OFF_LABEL,
  ERROR_LABEL,
  VERDICT_LABEL,
  type BulkResponse,
  type BulkRow,
} from "./bulk-check-shared";

type Phase = "idle" | "running" | "done" | "cancelled" | "error";
type SortKey = "ico" | "name" | "legalForm" | "city" | "verdict" | "eetOff" | "establishments";

const MAX_BUSY_RETRIES = 4;
const MAX_FILE_BYTES = 1_000_000;

const VERDICT_ORDER: Record<Verdict, number> = { likely: 0, possible: 1, unlikely: 2, dissolved: 3 };
const VERDICT_CHIP: Record<Verdict, string> = {
  likely: "bg-brand-100 text-brand-700",
  possible: "bg-sun-100 text-ink",
  unlikely: "bg-surface-2 text-ink-soft",
  dissolved: "bg-surface-2 text-muted",
};

const collator = new Intl.Collator("cs", { sensitivity: "base", numeric: true });

/* ─────────────── CSV ─────────────── */

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function normHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/["'.\s]/g, "")
    .toLowerCase();
}

/** Vytáhne IČO z CSV: sloupec pojmenovaný „IČO“/„ICO“/„IČ“, jinak první sloupec. */
function extractIcosFromCsv(text: string): string[] {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return [];
  const first = lines[0]!;
  const counts = [";", ",", "\t"].map((d) => [d, first.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0]![0];
  const header = splitCsvLine(first, delim).map(normHeader);
  let col = header.findIndex((h) => h === "ico" || h === "ic");
  let start = 1;
  if (col < 0) {
    col = 0;
    start = /^\s*"?\d[\d\s]*"?\s*$/.test(splitCsvLine(first, delim)[0] ?? "") ? 0 : 1;
  }
  return lines
    .slice(start)
    .map((l) => (splitCsvLine(l, delim)[col] ?? "").replace(/\s+/g, ""))
    .filter(Boolean);
}

function downloadCsv(rows: readonly BulkRow[]) {
  const header = ["IČO", "Název", "Právní forma", "Obec", "EET 2.0 (orientačně)", "EET OFF", "Aktivní provozovny (RŽP)", "Poznámka"];
  const lines = [header.map(csvCell).join(";")];
  for (const r of rows) {
    lines.push(
      [
        r.ico,
        r.name,
        r.legalForm,
        r.city,
        r.verdict ? VERDICT_LABEL[r.verdict] : "",
        r.eetOff ? EET_OFF_LABEL[r.eetOff] : "",
        r.establishments,
        r.error ? ERROR_LABEL[r.error] : "",
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kontrola-eet-ico-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─────────────── helpers ─────────────── */

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Zrušeno", "AbortError"));
      },
      { once: true },
    );
  });
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sortValue(r: BulkRow, key: SortKey): string | number {
  switch (key) {
    case "verdict":
      return r.verdict ? VERDICT_ORDER[r.verdict] : 9;
    case "eetOff":
      return r.eetOff ? ["possible", "check", "not_available"].indexOf(r.eetOff) : 9;
    case "establishments":
      return r.establishments ?? -1;
    default:
      return r[key] ?? "";
  }
}

/* ─────────────── component ─────────────── */

export function BulkCheck() {
  const [text, setText] = useState("");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const parsed = useMemo(() => parseIcoList(text), [text]);
  const toCheck = parsed.valid.slice(0, BULK_MAX_TOTAL);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : collator.compare(String(va), String(vb));
      return c * sort.dir;
    });
  }, [rows, sort]);

  const summary = useMemo(() => {
    const s = { likely: 0, possible: 0, unlikely: 0, dissolved: 0, error: 0 };
    for (const r of rows) {
      if (r.error) s.error++;
      else if (r.verdict) s[r.verdict]++;
    }
    return s;
  }, [rows]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileNote("Soubor je větší než 1 MB. Vložte prosím jen sloupec s IČO.");
      return;
    }
    const icos = extractIcosFromCsv(await file.text());
    if (!icos.length) {
      setFileNote(`V souboru ${file.name} jsme nenašli žádné hodnoty.`);
      return;
    }
    setText((prev) => (prev.trim() ? `${prev.trim()}\n` : "") + icos.join("\n"));
    setFileNote(`Načteno ${icos.length} hodnot ze souboru ${file.name}.`);
  }

  async function run() {
    if (!toCheck.length) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const order = toCheck;
    const results = new Map<string, BulkRow>();
    const retries = new Map<string, number>();
    const queue = chunk(order, BULK_MAX_BATCH);

    setRows([]);
    setTotal(order.length);
    setError(null);
    setNotice(null);
    setSort(null);
    setPhase("running");

    const publish = () => setRows(order.filter((i) => results.has(i)).map((i) => results.get(i)!));

    try {
      while (queue.length) {
        const batch = queue.shift()!;
        const res = await fetch("/api/ico/hromadne", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ icos: batch }),
          signal: ctrl.signal,
        });
        if (res.status === 429) {
          const wait = Math.max(1, Number(res.headers.get("retry-after")) || 10);
          setNotice(`Krátká pauza kvůli limitu dotazů – pokračujeme za ${wait} s.`);
          await sleep(wait * 1000, ctrl.signal);
          queue.unshift(batch);
          continue;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Kontrolu se nepodařilo dokončit. Zkuste to prosím znovu.");
        }
        const data = (await res.json()) as BulkResponse;
        const again: string[] = [];
        for (const r of data.rows) {
          const n = retries.get(r.ico) ?? 0;
          if (r.error === "busy" && n < MAX_BUSY_RETRIES) {
            retries.set(r.ico, n + 1);
            again.push(r.ico);
          } else results.set(r.ico, r);
        }
        publish();
        setNotice(null);
        if (again.length) {
          queue.push(again);
          const wait = data.retryAfter ?? 15;
          setNotice(`Registr ARES je vytížený – zbývajících ${again.length} IČO zkusíme znovu za ${wait} s.`);
          await sleep(wait * 1000, ctrl.signal);
        }
      }
      setNotice(null);
      setPhase("done");
    } catch (e) {
      publish();
      if (e instanceof DOMException && e.name === "AbortError") {
        setNotice(null);
        setPhase("cancelled");
      } else {
        setError(e instanceof Error ? e.message : "Kontrolu se nepodařilo dokončit.");
        setPhase("error");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));
  }

  const running = phase === "running";
  const pct = total ? Math.round((rows.length / total) * 100) : 0;

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "ico", label: "IČO" },
    { key: "name", label: "Název" },
    { key: "legalForm", label: "Forma" },
    { key: "city", label: "Obec" },
    { key: "verdict", label: "EET 2.0" },
    { key: "eetOff", label: "EET OFF" },
    { key: "establishments", label: "Provozovny", className: "text-right" },
  ];

  return (
    <div className="space-y-8">
      <section className="card space-y-5 p-5 sm:p-8" aria-labelledby="vstup-h">
        <h2 id="vstup-h" className="text-xl font-bold">
          1. Vložte IČO klientů
        </h2>
        <div>
          <label htmlFor="bulk-icos" className="label">
            Seznam IČO
          </label>
          <textarea
            id="bulk-icos"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            spellCheck={false}
            className="input font-mono text-[15px]"
            placeholder={"27082440\n00006947, 45274649\n…"}
            aria-describedby="bulk-icos-hint bulk-icos-count"
            disabled={running}
          />
          <p id="bulk-icos-hint" className="mt-1.5 text-sm text-muted">
            Oddělte čárkou, středníkem, mezerou nebo novým řádkem. Duplicity odstraníme. Najednou zkontrolujete až{" "}
            {BULK_MAX_TOTAL} IČO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className={`btn-secondary cursor-pointer ${running ? "pointer-events-none opacity-60" : ""}`}>
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFile} disabled={running} />
            Nahrát CSV
          </label>
          <span className="text-sm text-muted">První sloupec, nebo sloupec s názvem „IČO“.</span>
          {text && !running && (
            <button
              type="button"
              className="btn-ghost ml-auto px-3 py-2 text-sm"
              onClick={() => {
                setText("");
                setFileNote(null);
              }}
            >
              Vymazat
            </button>
          )}
        </div>
        {fileNote && (
          <p className="text-sm text-ink-soft" role="status">
            {fileNote}
          </p>
        )}

        <div id="bulk-icos-count" className="rounded-xl bg-surface p-4 text-[15px]" aria-live="polite">
          <p>
            <strong>{parsed.valid.length}</strong> platných IČO
            {parsed.invalid.length > 0 && (
              <>
                {" "}
                · <strong className="text-danger-600">{parsed.invalid.length}</strong> neplatných položek
              </>
            )}
          </p>
          {parsed.invalid.length > 0 && (
            <p className="mt-1 break-words text-sm text-muted">
              Neplatné (špatný počet číslic nebo kontrolní číslice): {parsed.invalid.slice(0, 10).join(", ")}
              {parsed.invalid.length > 10 && ` a dalších ${parsed.invalid.length - 10}`}
            </p>
          )}
          {parsed.valid.length > BULK_MAX_TOTAL && (
            <p className="mt-1 text-sm text-warn-700">Zkontrolujeme prvních {BULK_MAX_TOTAL} IČO, zbytek pošlete v dalším kole.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={run} disabled={running || !toCheck.length}>
            {running ? "Kontroluji…" : toCheck.length ? `Zkontrolovat ${toCheck.length} IČO` : "Zkontrolovat IČO"}
          </button>
          {running && (
            <button type="button" className="btn-secondary" onClick={() => abortRef.current?.abort()}>
              Zastavit
            </button>
          )}
        </div>
      </section>

      {(phase !== "idle" || rows.length > 0) && (
        <section className="space-y-5" aria-labelledby="vysledky-h">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="vysledky-h" className="text-xl font-bold">
                2. Výsledky
              </h2>
              <p className="mt-1 text-sm text-muted">Klikněte na záhlaví sloupce pro řazení. Detail otevřete kliknutím na IČO.</p>
            </div>
            <button type="button" className="btn-primary" onClick={() => downloadCsv(sorted)} disabled={!rows.length}>
              Stáhnout CSV
            </button>
          </div>

          <div aria-live="polite" className="space-y-2">
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label="Průběh kontroly"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={rows.length}
            >
              <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-ink-soft">
              {phase === "done" && `Hotovo – zkontrolováno ${rows.length} z ${total} IČO.`}
              {phase === "running" && `Zkontrolováno ${rows.length} z ${total} IČO…`}
              {phase === "cancelled" && `Zastaveno – zkontrolováno ${rows.length} z ${total} IČO.`}
              {phase === "error" && `Přerušeno – zkontrolováno ${rows.length} z ${total} IČO.`}
              {notice && <span className="ml-1 text-warn-700">{notice}</span>}
            </p>
            {error && (
              <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-[15px] text-danger-600">
                {error}
              </p>
            )}
          </div>

          {rows.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm" aria-label="Souhrn výsledků">
              <li className={`chip ${VERDICT_CHIP.likely}`}>Pravděpodobně ano: {summary.likely}</li>
              <li className={`chip ${VERDICT_CHIP.possible}`}>Možná: {summary.possible}</li>
              <li className={`chip ${VERDICT_CHIP.unlikely}`}>Pravděpodobně ne: {summary.unlikely}</li>
              {summary.dissolved > 0 && <li className={`chip ${VERDICT_CHIP.dissolved}`}>Zaniklé: {summary.dissolved}</li>}
              {summary.error > 0 && <li className="chip bg-danger-50 text-danger-600">Chyby: {summary.error}</li>}
            </ul>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[760px] border-collapse text-left text-[15px]">
                <caption className="sr-only">Výsledky hromadné kontroly IČO</caption>
                <thead>
                  <tr className="bg-surface">
                    {columns.map((c) => {
                      const active = sort?.key === c.key;
                      return (
                        <th
                          key={c.key}
                          scope="col"
                          aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}
                          className={`px-3 py-2 text-sm font-semibold text-ink-soft ${c.className ?? ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className="inline-flex items-center gap-1 rounded hover:text-brand-700"
                          >
                            {c.label}
                            <span aria-hidden="true" className={active ? "text-brand-700" : "text-line"}>
                              {active ? (sort!.dir === 1 ? "▲" : "▼") : "↕"}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.ico} className="border-t border-line align-top">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono">
                        <Link
                          href={`/kontrola-ico?ico=${r.ico}`}
                          target="_blank"
                          className="text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-600"
                        >
                          {r.ico}
                          <span className="sr-only"> (detail v novém okně)</span>
                        </Link>
                      </td>
                      {r.error ? (
                        <td colSpan={6} className="px-3 py-2.5">
                          <span className="chip bg-danger-50 text-danger-600">{ERROR_LABEL[r.error]}</span>
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2.5 font-medium text-ink">{r.name}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">{r.legalForm}</td>
                          <td className="px-3 py-2.5 text-ink-soft">{r.city}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            {r.verdict && <span className={`chip ${VERDICT_CHIP[r.verdict]}`}>{VERDICT_LABEL[r.verdict]}</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">
                            {r.eetOff && (
                              <span title={EET_OFF_HINT[r.eetOff]}>
                                {EET_OFF_LABEL[r.eetOff]}
                                <span className="sr-only"> – {EET_OFF_HINT[r.eetOff]}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{r.establishments}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
