"use client";

import { useMemo, useState } from "react";
import { formatCzk } from "@ez/fiscal-core";
import {
  DELIMITER_LABEL,
  ENCODING_LABEL,
  FIELD_LABEL,
  IMPORT_LIMITS,
  IMPORT_PRESETS,
  ImportFileError,
  buildPreview,
  readImportFile,
  type ImportField,
  type ImportMapping,
  type ImportStatus,
  type ImportTable,
} from "@/lib/pos/import-products";
import { call } from "./api";

const FIELDS = ["name", "price", "priceNet", "vat", "category", "code"] as const satisfies readonly ImportField[];
const STATUS_LABEL: Record<ImportStatus, string> = { ok: "Přidáme", error: "Chyba", duplicate: "Duplicita", skipped: "Přeskočíme" };
const PREVIEW_ROWS = 200;

interface Result {
  created: number;
  ids: string[];
  skipped: { name: string }[];
}

/**
 * S2-E: „Importovat ze souboru“ v sekci Rychlá tlačítka. Soubor se čte jen v prohlížeči; na server jde až po náhledu
 * seznam položek (název, cena s DPH, sazba). Nic se neukládá do úložiště prohlížeče.
 */
export function CatalogImport({ vatPayer, existing, onChange }: { vatPayer: boolean; existing: readonly { name: string }[]; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<ImportTable | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [defaultVat, setDefaultVat] = useState(21);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  // nový klíč = prázdné pole souboru (stejný soubor jde pak vybrat znovu)
  const [inputKey, setInputKey] = useState(0);

  const preview = useMemo(
    () => (table ? buildPreview(table, mapping, { vatPayer, defaultVat, existingNames: existing.map((e) => e.name), existingCount: existing.length }) : null),
    [table, mapping, vatPayer, defaultVat, existing],
  );

  const reset = () => {
    setTable(null);
    setFileName(null);
    setMapping({});
    setError(null);
  };
  const clearFile = () => {
    reset();
    setInputKey((k) => k + 1);
  };

  async function onFile(file: File | undefined) {
    reset();
    setResult(null);
    if (!file) return;
    if (file.size > IMPORT_LIMITS.maxBytes) return setError("Soubor je větší než 1 MB. Rozdělte ho na menší části.");
    try {
      const t = readImportFile(new Uint8Array(await file.arrayBuffer()));
      setTable(t);
      setMapping(t.mapping);
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof ImportFileError ? e.message : "Soubor se nepodařilo přečíst.");
    }
  }

  async function submit() {
    if (!preview || preview.items.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await call<Result>("/api/ucet/katalog/import", { method: "POST", json: { items: preview.items } });
      setResult(r);
      clearFile();
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import se nepodařil.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!result || result.ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await call("/api/ucet/katalog/import", { method: "DELETE", json: { ids: result.ids } });
      setResult(null);
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import se nepodařilo vrátit.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          Importovat ze souboru
        </button>
        <p className="mt-1 text-sm text-muted">Přecházíte z jiné pokladny? Nahrajte její seznam zboží (CSV).</p>
      </div>
    );
  }

  return (
    <section className="mt-5 rounded-2xl border border-line p-4" aria-labelledby="import-h">
      <div className="flex items-start justify-between gap-3">
        <h3 id="import-h" className="text-lg font-bold">
          Import zboží ze souboru
        </h3>
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => (clearFile(), setResult(null), setOpen(false))}>
          Zavřít
        </button>
      </div>
      <p className="mt-1 text-[15px] text-ink-soft">
        Soubor CSV nebo TSV (oddělený středníkem, čárkou nebo tabulátorem), kódování UTF-8 i Windows-1250. Nejvýš {IMPORT_LIMITS.maxRows.toLocaleString("cs-CZ")} položek a 1 MB. Soubor
        Excelu (.xlsx) uložte jako „CSV (oddělený středníkem)“. Soubor zůstane ve vašem prohlížeči – na server pošleme jen položky, které po kontrole přidáte.
      </p>
      <details className="mt-2 text-sm text-ink-soft">
        <summary className="cursor-pointer font-medium text-brand-700">Kde najdu export ve staré pokladně?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {IMPORT_PRESETS.map((p) => (
            <li key={p.id}>
              <strong>{p.label}:</strong> {p.exportHint} Sloupce poznáme sami.
            </li>
          ))}
          <li>Jiná pokladna: hledejte export ceníku, produktů nebo zboží do CSV či Excelu. Sloupce s názvem, cenou a sazbou DPH přiřadíte níže.</li>
        </ul>
      </details>

      {result && (
        <div role="status" className="mt-4 rounded-xl bg-brand-50 p-3 text-[15px]">
          <p>
            Přidali jsme {result.created} {result.created === 1 ? "položku" : result.created >= 2 && result.created <= 4 ? "položky" : "položek"}.
            {result.skipped.length > 0 && ` ${result.skipped.length} jsme přeskočili – stejný název už v katalogu byl.`}
          </p>
          {result.ids.length > 0 && (
            <button type="button" className="btn-secondary mt-2 py-1.5 text-sm" disabled={busy} onClick={() => void undo()}>
              Vrátit import
            </button>
          )}
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="import-file" className="label">
          Soubor se zbožím
        </label>
        <input key={inputKey} id="import-file" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" className="block w-full text-[15px]" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>

      {table && preview && (
        <>
          <p className="mt-3 text-sm text-muted">
            {fileName} · {table.preset ? `export z pokladny ${table.preset.label} · ` : ""}
            {ENCODING_LABEL[table.encoding]} · oddělovač {DELIMITER_LABEL[table.delimiter]} · {table.rows.length} řádků
          </p>

          <fieldset className="mt-4">
            <legend className="text-[15px] font-semibold">Sloupce v souboru</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {FIELDS.filter((f) => vatPayer || f !== "vat").map((f) => (
                <div key={f}>
                  <label htmlFor={`map-${f}`} className="label">
                    {FIELD_LABEL[f]}
                  </label>
                  <select
                    id={`map-${f}`}
                    className="input w-full"
                    value={mapping[f] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === "" ? undefined : Number(e.target.value) })}
                  >
                    <option value="">— v souboru není —</option>
                    {table.headers.map((h, i) => (
                      <option key={`${i}-${h}`} value={i}>
                        {h || `Sloupec ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {vatPayer && (
                <div>
                  <label htmlFor="map-default-vat" className="label">
                    Sazba pro řádky bez sazby
                  </label>
                  <select id="map-default-vat" className="input w-full" value={defaultVat} onChange={(e) => setDefaultVat(Number(e.target.value))}>
                    <option value={21}>21 %</option>
                    <option value={12}>12 %</option>
                    <option value={0}>0 %</option>
                  </select>
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-muted">Kategorie určí pořadí tlačítek (zboží jedné kategorie bude vedle sebe). Kategorie ani kód se zatím neukládají.</p>
          </fieldset>

          {preview.notices.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-xl bg-sun-100 p-3 text-[15px]">
              {preview.notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-[15px]">
            <strong>Přidáme {preview.items.length}</strong> · chyby {preview.counts.error} · duplicity {preview.counts.duplicate} · přeskočíme {preview.counts.skipped}
          </p>

          <div className="mt-2 max-h-96 overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <caption className="sr-only">Náhled importu</caption>
              <thead className="sticky top-0 bg-surface">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Řádek
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Název
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Cena
                  </th>
                  {vatPayer && (
                    <th scope="col" className="px-3 py-2 text-right">
                      DPH
                    </th>
                  )}
                  <th scope="col" className="px-3 py-2">
                    Kategorie
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Stav
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, PREVIEW_ROWS).map((r) => (
                  <tr key={r.line} className={`border-t border-line ${r.status === "error" ? "bg-danger-50" : r.status === "ok" ? "" : "text-muted"}`}>
                    <td className="px-3 py-1.5 tabular-nums">{r.line}</td>
                    <td className="px-3 py-1.5">{r.name || "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.price === null ? "—" : formatCzk(r.price)}</td>
                    {vatPayer && <td className="px-3 py-1.5 text-right tabular-nums">{r.vatRate} %</td>}
                    <td className="px-3 py-1.5">{r.category ?? ""}</td>
                    <td className={`px-3 py-1.5 ${r.status === "error" ? "font-semibold text-danger-600" : ""}`}>
                      {STATUS_LABEL[r.status]}
                      {r.message && <span className="block text-xs">{r.message}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > PREVIEW_ROWS && <p className="mt-1 text-sm text-muted">Náhled ukazuje prvních {PREVIEW_ROWS} řádků z {preview.rows.length}.</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy || preview.items.length === 0} onClick={() => void submit()}>
              Přidat {preview.items.length} {preview.items.length === 1 ? "položku" : preview.items.length >= 2 && preview.items.length <= 4 ? "položky" : "položek"} do katalogu
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={clearFile}>
              Vybrat jiný soubor
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-50 p-3 text-[15px] text-danger-600">
          {error}
        </p>
      )}
    </section>
  );
}
