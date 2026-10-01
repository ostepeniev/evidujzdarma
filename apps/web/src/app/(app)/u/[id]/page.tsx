import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasDatabase } from "@ez/db";
import { PAYMENT_LABEL, formatCzk, formatReceiptDate } from "@ez/fiscal-core";
import { LogoMark } from "@/components/logo";
import { loadReceipt } from "@/lib/server/receipts";

export const metadata: Metadata = { title: "Účtenka", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: PageProps<"/u/[id]">) {
  const { id } = await params;
  const r = hasDatabase() ? await loadReceipt(id) : null;
  if (!r) notFound();
  const { merchant: m, sale: s, fiscal } = r;

  return (
    <div className="min-h-dvh bg-surface px-4 py-8">
      <article className="mx-auto max-w-md rounded-3xl border border-line bg-white p-6 shadow-sm">
        <header className="text-center">
          <h1 className="text-xl font-bold">{m.name}</h1>
          {m.address && <p className="text-sm text-ink-soft">{m.address}</p>}
          <p className="text-sm text-ink-soft">
            {m.ico && <>IČO {m.ico}</>}
            {m.dic && <> · DIČ {m.dic}</>}
          </p>
          {m.header && <p className="mt-2 text-sm">{m.header}</p>}
        </header>
        {s.refundOf && <p className="mt-4 rounded-xl bg-surface p-2 text-center text-sm font-semibold">Vratka / opravný doklad</p>}
        <table className="mt-5 w-full text-[15px]">
          <tbody className="divide-y divide-line">
            {s.lines.map((l, i) => (
              <tr key={i}>
                <td className="py-2">
                  {l.name}
                  {l.qty !== 1 && (
                    <span className="block text-xs text-muted">
                      {l.qty} × {formatCzk(l.unitPrice)}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">{formatCzk(Math.round(l.qty * l.unitPrice))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 space-y-1 border-t border-line pt-4 text-[15px]">
          {s.discount > 0 && (
            <div className="flex justify-between">
              <dt>Sleva</dt>
              <dd>−{formatCzk(s.discount)}</dd>
            </div>
          )}
          {s.tip > 0 && (
            <div className="flex justify-between">
              <dt>Spropitné</dt>
              <dd>{formatCzk(s.tip)}</dd>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold">
            <dt>Celkem</dt>
            <dd className="tabular-nums">{formatCzk(s.total)}</dd>
          </div>
          {s.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-ink-soft">
              <dt>{PAYMENT_LABEL[p.method]}</dt>
              <dd>{formatCzk(p.amount)}</dd>
            </div>
          ))}
        </dl>
        {s.vat && (
          <table className="mt-4 w-full text-sm text-ink-soft">
            <thead>
              <tr>
                <th className="text-left font-medium">Sazba DPH</th>
                <th className="text-right font-medium">Základ</th>
                <th className="text-right font-medium">DPH</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(s.vat).map(([rate, v]) => (
                <tr key={rate}>
                  <td>{rate} %</td>
                  <td className="text-right">{formatCzk(v.base)}</td>
                  <td className="text-right">{formatCzk(v.vat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <dl className="mt-5 space-y-1 border-t border-line pt-4 text-sm text-ink-soft">
          <div className="flex justify-between">
            <dt>Datum</dt>
            <dd>{formatReceiptDate(s.soldAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Číslo dokladu</dt>
            <dd>{s.sequence}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Pokladna / jednotka</dt>
            <dd>
              {s.registerId} / {s.unitId}
            </dd>
          </div>
          {fiscal.showCode === false ? null : fiscal.confirmationCode ? (
            <div>
              <dt>POK (potvrzovací kód FS)</dt>
              <dd className="break-all font-mono text-xs">{fiscal.confirmationCode}</dd>
            </div>
          ) : (
            <p>Tržba čeká na potvrzení Finanční správou.</p>
          )}
          {fiscal.mode === "test" && <p className="font-semibold text-warn-700">Testovací doklad – tržba nebyla evidována v ostrém provozu.</p>}
        </dl>
        {m.footer && <p className="mt-4 text-center text-sm">{m.footer}</p>}
      </article>
      <footer className="mx-auto mt-6 flex max-w-md items-center justify-center gap-2 text-sm text-muted">
        <LogoMark className="h-5 w-5" />
        <span>
          Účtenku vystavila bezplatná pokladna{" "}
          <Link href="/?utm_source=uctenka" className="font-medium text-brand-700 underline">
            EvidujZdarma
          </Link>
        </span>
      </footer>
    </div>
  );
}
