"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { PAYMENT_LABEL, deadlineFor, formatRemaining, renderReceiptText, urgency } from "@ez/fiscal-core";
import { getSale } from "@/lib/pos/db";
import { bluetoothSupported, printEscPos } from "@/lib/pos/escpos";
import { emailReceipt, onSyncChange, resendSale, syncNow } from "@/lib/pos/sync";
import type { LocalSale, PosConfig } from "@/lib/pos/types";
import { Sheet, StatusChip, kc } from "./ui";

export function receiptTextFor(sale: LocalSale, config: PosConfig, width = 42): string {
  const unit = config.units.find((u) => u.id === sale.unitId);
  // Položky na dokladu zobrazujeme před slevou, sleva je samostatný řádek.
  return renderReceiptText(
    {
      merchant: {
        name: config.account.name,
        dic: config.account.dic,
        ico: config.account.ico,
        address: unit?.address ?? null,
        unitLabel: sale.unitLabel,
        header: config.account.receiptHeader,
        footer: config.account.receiptFooter,
      },
      sale: {
        id: sale.id,
        registerId: config.device.registerId,
        unitId: String(unit?.fsUnitId ?? "—"),
        sequence: sale.sequence,
        soldAt: sale.soldAt,
        lines: sale.lines,
        payments: sale.payments,
        discount: sale.discount,
        tip: sale.tip,
        subtotal: sale.subtotal,
        total: sale.total,
        vat: sale.vat,
        refundOf: sale.refundOf,
      },
      fiscal: {
        confirmationCode: sale.confirmationCode,
        securityCode: null,
        mode: sale.mode === "production" ? "production" : "test",
        showCode: config.account.receiptShowPok !== false,
      },
      cashReceived: sale.cashReceived ?? undefined,
      url: `${location.origin}/u/${sale.id}`,
    },
    width,
  );
}

export function ReceiptView({
  saleId,
  config,
  onNew,
  onRefund,
  onBack,
}: {
  saleId: string;
  config: PosConfig;
  onNew: () => void;
  onRefund?: (sale: LocalSale) => void;
  onBack?: () => void;
}) {
  const [sale, setSale] = useState<LocalSale | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = () => void getSale(saleId).then((s) => setSale(s ?? null));
    load();
    return onSyncChange(load);
  }, [saleId]);

  const text = useMemo(() => (sale ? receiptTextFor(sale, config) : ""), [sale, config]);
  if (!sale) return <p className="p-8 text-center text-muted">Načítám…</p>;

  const change = sale.cashReceived ? sale.cashReceived - sale.total : 0;
  const deadline = deadlineFor(sale.soldAt);
  const pending = ["local", "queued", "sending", "failed"].includes(sale.status);
  const urg = urgency(deadline);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="no-print rounded-3xl border border-line bg-white p-6 text-center">
        <p className="text-sm text-muted">{sale.refundOf ? "Vráceno" : "Zaplaceno"} · {sale.payments.map((p) => PAYMENT_LABEL[p.method]).join(", ")}</p>
        <p className="mt-1 text-5xl font-extrabold tabular-nums">{kc(Math.abs(sale.total))}</p>
        {change > 0 && (
          <p className="mt-3 inline-block rounded-2xl bg-sun-100 px-4 py-2 text-xl">
            Vrátit: <strong className="tabular-nums">{kc(change)}</strong>
          </p>
        )}
        <div className="mt-4 flex flex-col items-center gap-2">
          <StatusChip status={sale.status} />
          {sale.confirmationCode && <p className="break-all font-mono text-xs text-ink-soft">POK {sale.confirmationCode}</p>}
          {pending && (
            <p className={`text-sm ${urg === "critical" || urg === "overdue" ? "text-danger-600" : "text-ink-soft"}`}>
              {navigator.onLine ? "Odesílám Finanční správě…" : "Jste offline – tržba je uložená a odešle se sama."} Lhůta: {formatRemaining(deadline)}.
            </p>
          )}
          {sale.status === "rejected" && (
            <div className="space-y-2">
              {sale.error && <p className="text-sm text-danger-600">{sale.error}</p>}
              <button type="button" className="btn-secondary py-2 text-[15px]" onClick={() => void resendSale(sale.id)}>
                Odeslat znovu
              </button>
            </div>
          )}
          {sale.mode === "mock" && <p className="text-xs text-muted">Ukázkový režim – tržba se Finanční správě neodesílá.</p>}
        </div>
      </div>

      <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          Tisk
        </button>
        {bluetoothSupported() && (
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                await printEscPos(receiptTextFor(sale, config, 32), 32);
                setMessage("Vytištěno.");
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Tisk se nezdařil");
              }
            }}
          >
            Bluetooth
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={() => setEmailOpen(true)}>
          E-mail
        </button>
        <button type="button" className="btn-secondary" onClick={() => setQrOpen(true)}>
          QR účtenka
        </button>
      </div>
      {message && (
        <p role="status" className="no-print text-center text-sm text-ink-soft">
          {message}
        </p>
      )}

      <pre className="receipt-paper mx-auto w-full max-w-[22rem] overflow-x-auto rounded-2xl border border-line bg-white p-4 font-mono text-[11px] leading-snug text-ink">{text}</pre>

      <div className="no-print flex flex-col gap-2 sm:flex-row">
        {onBack && (
          <button type="button" className="btn-secondary flex-1" onClick={onBack}>
            ← Zpět
          </button>
        )}
        {onRefund && !sale.refundOf && sale.total > 0 && sale.status !== "rejected" && (
          <button type="button" className="btn-secondary flex-1" onClick={() => onRefund(sale)}>
            Vratka
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-4 text-lg" onClick={onNew}>
          Nová tržba
        </button>
      </div>

      {emailOpen && <EmailSheet sale={sale} onClose={() => setEmailOpen(false)} onSent={() => (setEmailOpen(false), setMessage("Účtenka odeslána e-mailem."))} />}
      {qrOpen && <QrSheet url={`${location.origin}/u/${sale.id}`} synced={!!sale.syncedAt} onClose={() => setQrOpen(false)} />}
    </div>
  );
}

function EmailSheet({ sale, onClose, onSent }: { sale: LocalSale; onClose: () => void; onSent: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title="Účtenka e-mailem" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          if (!sale.syncedAt) await syncNow().catch(() => {});
          const r = await emailReceipt(sale.id, email);
          setBusy(false);
          if (r.ok) onSent();
          else setError(r.error ?? "Nepodařilo se odeslat");
        }}
      >
        <label htmlFor="rcpt-email" className="label">
          E-mail zákazníka
        </label>
        <input id="rcpt-email" type="email" required autoComplete="off" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <p className="mt-2 text-danger-600">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary mt-4 w-full">
          {busy ? "Odesílám…" : "Odeslat účtenku"}
        </button>
        <p className="mt-2 text-xs text-muted">E-mail použijeme jen k doručení účtenky.</p>
      </form>
    </Sheet>
  );
}

function QrSheet({ url, synced, onClose }: { url: string; synced: boolean; onClose: () => void }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, width: 280 }).then(setSvg);
    if (!synced) void syncNow().catch(() => {});
  }, [url, synced]);
  return (
    <Sheet title="Účtenka v telefonu zákazníka" onClose={onClose}>
      {svg && <div className="mx-auto w-full max-w-[280px]" role="img" aria-label="QR kód s odkazem na účtenku" dangerouslySetInnerHTML={{ __html: svg }} />}
      <p className="mt-3 text-center text-[15px] text-ink-soft">Zákazník naskenuje kód fotoaparátem a účtenku si uloží.</p>
      {!synced && <p className="mt-2 text-center text-sm text-warn-700">Účtenka bude online, jakmile se pokladna připojí k internetu.</p>}
    </Sheet>
  );
}
