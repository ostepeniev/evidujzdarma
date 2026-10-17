import { formatIban } from "@ez/cz/bank";
import { formatCzDate, formatCzk, parseCzNumber } from "@/lib/doc-tools";
import {
  INVOICE_PAYMENTS,
  type Invoice,
  type InvoiceParty,
  type InvoiceTotals,
  filledInvoiceItems,
  invoiceNotices,
  invoiceTitle,
  isSimplified,
  itemBase,
} from "@/lib/faktura";

const num = (n: number) => new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const date = (iso: string) => (iso ? formatCzDate(iso) : "—");

function Party({ role, party, registry, empty }: { role: string; party: InvoiceParty; registry?: string; empty: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{role}</p>
      <p className="mt-1 text-base font-bold">{party.name.trim() || empty}</p>
      {party.address.trim() && <p className="whitespace-pre-line">{party.address.trim()}</p>}
      {party.ico.trim() && <p>IČO: {party.ico.trim()}</p>}
      {party.dic.trim() && <p>DIČ: {party.dic.trim()}</p>}
      {registry?.trim() && <p className="mt-1 text-xs text-ink-soft">{registry.trim()}</p>}
    </div>
  );
}

/**
 * Faktura jako A4 papír (.doc-paper – při tisku se tiskne jen ona). Čistě prezentační: generátor (klient) i vzor (server)
 * mu předávají hotová data, QR kód jako SVG.
 */
export function InvoicePaper({
  inv,
  totals,
  dueDate,
  vs,
  iban,
  qrSvg,
  paper = true,
}: {
  inv: Invoice;
  totals: InvoiceTotals;
  dueDate: string;
  vs: string;
  iban: string | null;
  qrSvg: string | null;
  /** false = ukázka na stránce s více fakturami (bez .doc-paper, jinak by se při tisku překryly) */
  paper?: boolean;
}) {
  const taxDoc = inv.vatPayer && inv.kind === "faktura";
  const simplified = isSimplified(inv, totals);
  const rows = filledInvoiceItems(inv.items);
  const cols = inv.vatPayer ? 6 : 5;
  return (
    <div className={`${paper ? "doc-paper " : ""}card mx-auto w-full max-w-[210mm] bg-white p-5 text-[13px] leading-snug text-ink sm:p-10`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b-2 border-ink pb-3">
        <p className="text-xl font-extrabold uppercase tracking-wide sm:text-2xl">{invoiceTitle(inv, totals)}</p>
        <p className="text-base">
          č. <strong>{inv.number.trim() || "—"}</strong>
        </p>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Party role="Dodavatel" party={inv.supplier} registry={inv.supplier.registry} empty="Jméno nebo název dodavatele" />
        {simplified ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Odběratel</p>
            <p className="mt-1 text-ink-soft">Neuvádí se (zjednodušený daňový doklad).</p>
          </div>
        ) : (
          <Party role="Odběratel" party={inv.customer} empty="Jméno nebo název odběratele" />
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-line py-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Datum vystavení</dt>
          <dd className="font-semibold">{date(inv.issueDate)}</dd>
        </div>
        {taxDoc && (
          <div>
            <dt className="text-xs text-muted">Datum uskutečnění plnění</dt>
            <dd className="font-semibold">{date(inv.taxDate)}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted">Datum splatnosti</dt>
          <dd className="font-semibold">{date(dueDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Způsob úhrady</dt>
          <dd className="font-semibold">{INVOICE_PAYMENTS[inv.payment]}</dd>
        </div>
      </dl>

      {inv.payment === "prevodem" && (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-muted">Bankovní účet:</dt>
            <dd className="font-semibold">{inv.account.trim() || "—"}</dd>
            {iban && (
              <>
                <dt className="text-muted">IBAN:</dt>
                <dd>{formatIban(iban)}</dd>
              </>
            )}
            <dt className="text-muted">Variabilní symbol:</dt>
            <dd className="font-semibold">{vs || "—"}</dd>
          </dl>
          {qrSvg && (
            <div className="text-center">
              <div className="h-[30mm] w-[30mm] [&_svg]:h-full [&_svg]:w-full" role="img" aria-label="QR kód pro platbu" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-1 text-xs font-semibold">QR Platba</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse">
        <thead>
          <tr className="border-b border-ink text-left text-xs text-muted">
            <th className="py-1.5 pr-2 font-semibold">Položka</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Množství</th>
            <th className="py-1.5 pr-2 font-semibold">MJ</th>
            <th className="py-1.5 pr-2 text-right font-semibold">{inv.vatPayer ? "Cena za MJ bez DPH" : "Cena za MJ"}</th>
            {inv.vatPayer && <th className="py-1.5 pr-2 text-right font-semibold">DPH</th>}
            <th className="py-1.5 text-right font-semibold">{inv.vatPayer ? "Celkem bez DPH" : "Celkem"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols} className="py-2 text-muted">
                Položky se zobrazí tady.
              </td>
            </tr>
          )}
          {rows.map((it, i) => {
            const base = itemBase(it);
            const price = parseCzNumber(it.price);
            return (
              <tr key={i} className="border-b border-line align-top">
                <td className="py-1.5 pr-2">{it.name.trim() || "—"}</td>
                <td className="py-1.5 pr-2 text-right">{it.qty.trim() || "1"}</td>
                <td className="py-1.5 pr-2">{it.unit.trim()}</td>
                <td className="whitespace-nowrap py-1.5 pr-2 text-right">{price === null ? "?" : num(price)}</td>
                {inv.vatPayer && <td className="whitespace-nowrap py-1.5 pr-2 text-right">{it.rate} %</td>}
                <td className="whitespace-nowrap py-1.5 text-right">{base === null ? "?" : num(base)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="mt-4 flex flex-col items-end gap-3">
        {inv.vatPayer && totals.recap.length > 0 && (
          <table className="w-full max-w-md border-collapse text-right">
            <caption className="pb-1 text-left text-xs font-semibold uppercase tracking-wide text-muted">Rekapitulace DPH</caption>
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-1 pr-2 text-left font-semibold">Sazba</th>
                <th className="py-1 pr-2 font-semibold">Základ daně</th>
                <th className="py-1 pr-2 font-semibold">DPH</th>
                <th className="py-1 font-semibold">Celkem</th>
              </tr>
            </thead>
            <tbody>
              {totals.recap.map((r) => (
                <tr key={r.rate} className="border-b border-line">
                  <td className="py-1 pr-2 text-left">{r.rate} %</td>
                  <td className="whitespace-nowrap py-1 pr-2">{num(r.base)}</td>
                  <td className="whitespace-nowrap py-1 pr-2">{num(r.vat)}</td>
                  <td className="whitespace-nowrap py-1">{num(r.total)}</td>
                </tr>
              ))}
              {totals.recap.length > 1 && (
                <tr className="font-semibold">
                  <td className="py-1 pr-2 text-left">Celkem</td>
                  <td className="whitespace-nowrap py-1 pr-2">{num(totals.base)}</td>
                  <td className="whitespace-nowrap py-1 pr-2">{num(totals.vat)}</td>
                  <td className="whitespace-nowrap py-1">{num(totals.total)}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <p className="flex w-full max-w-md items-baseline justify-between gap-4 rounded-lg bg-surface px-3 py-2 text-lg font-extrabold">
          <span>Celkem k úhradě</span>
          <span className="whitespace-nowrap">{formatCzk(totals.total)}</span>
        </p>
      </div>

      {inv.note.trim() && <p className="mt-5 whitespace-pre-line">{inv.note.trim()}</p>}
      {invoiceNotices(inv).map((t) => (
        <p key={t} className="mt-3 text-sm font-semibold">
          {t}
        </p>
      ))}
    </div>
  );
}
