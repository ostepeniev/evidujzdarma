"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getConfig, getDevice, getMeta, peekSequence, pruneOld, refundsOf, rejectedSales, saleBySequence, setMeta, deleteMeta, unsettledSales } from "@/lib/pos/db";
import { AUTO_LOCK_MS, watchIdle } from "@/lib/pos/idle-lock";
import {
  createLocalSale,
  refundBlockedReason,
  refundSourceFromLocal,
  refundSourceFromServer,
  refundUnavailableReason,
  type RefundSource,
} from "@/lib/pos/sale-factory";
import { removeRegistrationPrompt, revokedNotice } from "@/lib/pos/revoked";
import { DeviceRevokedError, configVersion, isConfigStale, lookupRefundSale, onSyncChange, refreshConfig, startAutoSync, syncNow } from "@/lib/pos/sync";
import type { DeviceCredentials, LocalSale, PosConfig } from "@/lib/pos/types";
import { HistoryView, SummaryView } from "./history-view";
import { PaymentSheet, type PaymentResult } from "./payment-sheet";
import { OwnerApproval } from "./owner-approval";
import { PinLock } from "./pin-lock";
import { ReceiptView } from "./receipt-view";
import { RefundSheet, type RefundDraft } from "./refund-sheet";
import { RegisterScreen, type CartLine } from "./register-screen";
import { StatusBar } from "./status-bar";
import { Sheet, kc } from "./ui";

type Phase = "loading" | "unregistered" | "revoked" | "locked" | "ready";
type View = "register" | "history" | "summary";
interface Staff {
  id: string;
  name: string;
}

export function PosApp() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [device, setDevice] = useState<DeviceCredentials | null>(null);
  const [config, setConfig] = useState<PosConfig | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [view, setView] = useState<View>("register");
  const [unitId, setUnitId] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  // vratka (S3-POKLADNA): doklad → výběr položek → schválení vlastníkem → vrácení peněz
  const [paying, setPaying] = useState<null | { refund: { source: RefundSource; draft: RefundDraft } | null; approval?: string | null }>(null);
  const [refundSel, setRefundSel] = useState<RefundSource | null>(null);
  const [approval, setApproval] = useState<{ source: RefundSource; draft: RefundDraft } | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  /** číslo, které dostane příští tržba – variabilní symbol QR platby (S3-POKLADNA) */
  const [qrSequence, setQrSequence] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptFrom, setReceiptFrom] = useState<View>("register");
  const [revokedMessage, setRevokedMessage] = useState<string | null>(null);
  const onRevoked = useCallback((e: Error) => {
    setRevokedMessage(e.message);
    setPhase("revoked");
  }, []);

  const needsLock = (cfg: PosConfig) => cfg.staff.length > 1 || cfg.staff.some((s) => s.pinHash || s.onlinePin);

  const applyConfig = useCallback((cfg: PosConfig, dev: DeviceCredentials) => {
    setConfig(cfg);
    setUnitId((current) => {
      if (current && cfg.units.some((u) => u.id === current && u.active)) return current;
      return (cfg.units.find((u) => u.id === dev.unitId && u.active) ?? cfg.units.find((u) => u.active))?.id ?? "";
    });
  }, []);

  // Start: načtení zařízení a konfigurace z IndexedDB (funguje offline)
  useEffect(() => {
    let stop: (() => void) | undefined;
    (async () => {
      const dev = await getDevice();
      if (!dev) {
        setPhase("unregistered");
        return;
      }
      setDevice(dev);
      let cfg = await getConfig();
      try {
        cfg = (await refreshConfig()) ?? cfg;
      } catch (e) {
        if (e instanceof DeviceRevokedError) {
          onRevoked(e);
          return;
        }
      }
      if (!cfg) {
        setPhase("unregistered");
        return;
      }
      applyConfig(cfg, dev);
      const saved = await getMeta<{ staff: Staff; at: number }>("activeStaff");
      if (!needsLock(cfg)) {
        setStaff(cfg.staff[0] ? { id: cfg.staff[0].id, name: cfg.staff[0].name } : null);
        setPhase("ready");
      } else if (saved && Date.now() - saved.at < AUTO_LOCK_MS && cfg.staff.some((s) => s.id === saved.staff.id && s.role !== "owner")) {
        // uložené přihlášení obnovíme jen pokladní; vlastník se po načtení ověří znovu (R3.10)
        setStaff(saved.staff);
        setPhase("ready");
      } else setPhase("locked");
      stop = startAutoSync();
      void pruneOld();
    })();
    return () => stop?.();
  }, [applyConfig, onRevoked]);

  // Konfigurace se mění v nastavení → načíst při návratu do aplikace
  useEffect(() => {
    if (!device) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const cfg = await refreshConfig();
        if (cfg) applyConfig(cfg, device);
      } catch (e) {
        if (e instanceof DeviceRevokedError) onRevoked(e);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [device, applyConfig, onRevoked]);

  // Konfigurace načtená synchronizací (změna režimu účtu, obnova každých 5 min) se projeví hned (R5.1)
  const [configStale, setConfigStale] = useState(false);
  useEffect(() => {
    if (!device) return;
    let applied = configVersion();
    return onSyncChange(() => {
      setConfigStale(isConfigStale());
      const v = configVersion();
      if (v === applied) return;
      applied = v;
      void getConfig().then((cfg) => cfg && applyConfig(cfg, device));
    });
  }, [device, applyConfig]);

  // Aktivita obsluhy prodlužuje přihlášení; po 15 minutách bez práce se pokladna zamkne i otevřená (S3-POKLADNA)
  useEffect(() => {
    if (phase !== "ready" || !staff || !config || !needsLock(config)) return;
    const touch = (at = Date.now()) => void setMeta("activeStaff", { staff, at });
    touch();
    return watchIdle(
      window,
      () => {
        void deleteMeta("activeStaff");
        setPaying(null);
        setApproval(null);
        setRefundSel(null);
        setStaff(null);
        setPhase("locked");
      },
      { ms: AUTO_LOCK_MS, onActivity: touch, doc: document },
    );
  }, [phase, staff, config]);

  /**
   * Vratka: doklad z tohoto zařízení, nebo dohledaný na serveru podle čísla (i z jiné pokladny účtu, i starší než 7 dní).
   * Server zná i vratky z jiných pokladen – pokladna z nich spočítá, co ještě jde vrátit. Schválení vlastníkem je online.
   */
  async function openRefund(target: { local: LocalSale } | { q: string }) {
    if (!config) return;
    setRefundError(null);
    setRefundBusy(true);
    try {
      const local = "local" in target ? target.local : await saleBySequence(target.q);
      if (local && !("local" in target)) {
        // doklad z tohoto zařízení: ukázat účtenku, vratka se spustí z ní
        setReceiptFrom("history");
        setReceiptId(local.id);
        return;
      }
      if (local) await syncNow().catch(() => {});
      const found = await lookupRefundSale(local ? local.id : (target as { q: string }).q);
      let source: RefundSource;
      if (found.ok) source = refundSourceFromServer(found.data, await refundsOf(found.data.sale.id), !local);
      else if (local && found.notFound) source = refundSourceFromLocal(local, await refundsOf(local.id));
      else throw new Error(found.error);
      const blocked = refundBlockedReason(source, config.account.mode) ?? refundUnavailableReason(source, config, unitId);
      if (blocked) throw new Error(blocked);
      setRefundSel(source);
    } catch (e) {
      if (e instanceof DeviceRevokedError) return onRevoked(e);
      setRefundError(e instanceof Error ? e.message : "Doklad se nepodařilo načíst.");
    } finally {
      setRefundBusy(false);
    }
  }

  async function pay(r: PaymentResult) {
    if (!device || !config) return;
    setBusy(true);
    setPayError(null);
    try {
      const refund = paying?.refund?.source ?? null;
      let sale: LocalSale;
      if (refund && paying?.refund) {
        // režim účtu se mohl změnit, zatímco bylo okno vratky otevřené (R7.13)
        const blocked = refundBlockedReason(refund, config.account.mode);
        if (blocked) throw new Error(blocked);
        sale = await createLocalSale(device, config, {
          // vybrané položky a množství (částečná vratka, S3-POKLADNA)
          lines: paying.refund.draft.lines,
          // zrcadlo plateb originálu (R6.9); pokladní mohl zaměnit jen způsoby se stejnou evidencí
          payments: r.payments,
          discount: 0,
          tip: 0,
          cashReceived: null,
          refundOf: refund.id,
          approval: paying?.approval ?? null,
          unitId: refund.unitId ?? unitId,
          staff,
        });
      } else {
        sale = await createLocalSale(device, config, {
          lines: cart.map(({ key: _key, ...l }) => l),
          // jeden nebo víc způsobů platby (R6.9)
          payments: r.payments,
          discount,
          tip: r.tip,
          cashReceived: r.cashReceived,
          unitId,
          staff,
        });
        setCart([]);
        setDiscount(0);
      }
      setPaying(null);
      setReceiptFrom(view);
      setReceiptId(sale.id);
      void syncNow().catch((e) => e instanceof DeviceRevokedError && onRevoked(e));
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Tržbu se nepodařilo uložit");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") return <p className="p-10 text-center text-muted">Načítám pokladnu…</p>;

  // proč server pokladnu odmítl – u zrušeného účtu jeho text, ne „zaregistrujte znovu“ (R7.15 N9)
  const revoked = revokedNotice(revokedMessage);
  if (phase === "unregistered" || phase === "revoked")
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{phase === "revoked" ? "Toto zařízení bylo odpojeno" : "Tohle zařízení zatím není pokladna"}</h1>
        <p className="mt-3 text-ink-soft">
          {phase === "revoked"
            ? revoked.text
            : "Přihlaste se e-mailem, nastavte firmu a evidenční jednotku a toto zařízení zaregistrujte jako pokladnu. Zabere to asi 15 minut."}
        </p>
        {(phase !== "revoked" || revoked.canRegister) && (
          <Link href="/pokladna/nastaveni" className="btn-primary mt-6">
            Nastavit pokladnu
          </Link>
        )}
        {phase === "revoked" && (
          <button
            type="button"
            className="mt-3 block w-full text-sm text-muted underline"
            onClick={async () => {
              // neodeslané tržby zůstanou v zařízení a odejdou po nové registraci (A r1 nové Дрібне 6) – u zrušeného účtu
              // registrace není, tržby už do účtu nepředá (R8.3 N17, R9.11)
              const waiting = (await unsettledSales()).length + (await rejectedSales()).length;
              if (waiting && !window.confirm(removeRegistrationPrompt(waiting, revoked.canRegister))) return;
              await deleteMeta("device");
              await deleteMeta("config");
              location.reload();
            }}
          >
            Odebrat registraci z tohoto zařízení
          </button>
        )}
        <p className="mt-8 text-sm text-muted">
          Ještě se rozhodujete? <Link href="/srovnani/moje-eet" className="underline">Srovnání s MOJE eet</Link>
        </p>
        {/* S2-A: postup nastavení krok za krokem */}
        <p className="mt-2 text-sm text-muted">
          Jak na to? <Link href="/napoveda/prvni-spusteni" className="underline">Nápověda k pokladně</Link>
        </p>
      </div>
    );

  if (!config || !device) return null;

  if (phase === "locked")
    return (
      <PinLock
        config={config}
        onUnlock={(s) => {
          setStaff(s);
          void setMeta("activeStaff", { staff: s, at: Date.now() });
          setPhase("ready");
        }}
      />
    );

  const lock = needsLock(config)
    ? () => {
        void deleteMeta("activeStaff");
        setStaff(null);
        setPhase("locked");
      }
    : null;

  const activeUnits = config.units.filter((u) => u.active);

  return (
    <div className="min-h-dvh bg-surface">
      <StatusBar
        config={config}
        staffName={staff?.name ?? null}
        unitId={unitId}
        onUnit={setUnitId}
        onLock={lock}
        view={view}
        onView={(v) => {
          setReceiptId(null);
          setView(v);
        }}
      />
      {config.account.closed && (
        <p role="alert" className="bg-danger-50 px-4 py-2 text-center text-sm font-medium text-danger-600">
          Účet je zrušený. Pokladna už neprodává – jen předá tržby, které jsou v ní uložené, do účtu (Finanční správě se už neodesílají).
        </p>
      )}
      {configStale && (
        <p role="alert" className="bg-sun-100 px-4 py-2 text-center text-sm font-medium text-ink">
          Účet změnil režim evidence. Pokladna načítá nové nastavení – do té doby nelze prodávat. Zkontrolujte připojení k internetu.
        </p>
      )}
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
        {activeUnits.length === 0 ? (
          <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center">
            <p className="font-semibold">Chybí evidenční jednotka.</p>
            <Link href="/pokladna/nastaveni" className="btn-primary mt-4">
              Přidat v nastavení
            </Link>
          </div>
        ) : receiptId ? (
          <ReceiptView
            saleId={receiptId}
            config={config}
            onNew={() => {
              setReceiptId(null);
              setView("register");
            }}
            onBack={receiptFrom === "history" ? () => setReceiptId(null) : undefined}
            onRefund={(s) => {
              // výběr položek, pak schválení vlastníkem PINem ověřeným na serveru (R1.7, R3.10)
              void openRefund({ local: s });
            }}
            refundBusy={refundBusy}
          />
        ) : view === "history" ? (
          <HistoryView
            onOpen={(id) => {
              setReceiptFrom("history");
              setReceiptId(id);
            }}
            onFind={(q) => void openRefund({ q })}
            finding={refundBusy}
          />
        ) : view === "summary" ? (
          <SummaryView config={config} staff={staff} />
        ) : (
          <RegisterScreen
            config={config}
            cart={cart}
            setCart={setCart}
            discount={discount}
            setDiscount={setDiscount}
            onPay={() => {
              setPayError(null);
              setQrSequence(null);
              void peekSequence(device.sequencePrefix).then(setQrSequence);
              setPaying({ refund: null });
            }}
          />
        )}
      </main>

      {paying && (
        <PaymentSheet
          total={paying.refund ? paying.refund.draft.total : cart.reduce((s, l) => s + Math.round(l.qty * l.unitPrice), 0) - discount}
          config={config}
          qrSequence={qrSequence}
          noCredit={!paying.refund && cart.some((l) => l.kind === "prepayment")}
          busy={busy}
          error={payError}
          onClose={() => setPaying(null)}
          onPay={pay}
          refundPayments={paying.refund ? paying.refund.draft.payments : undefined}
        />
      )}
      {refundSel && (
        <RefundSheet
          source={refundSel}
          onClose={() => setRefundSel(null)}
          onContinue={(draft) => {
            setApproval({ source: refundSel, draft });
            setRefundSel(null);
          }}
        />
      )}
      {approval && (
        <OwnerApproval
          config={config}
          refund={{ refundOf: approval.source.id, amount: -approval.draft.total }}
          onClose={() => setApproval(null)}
          onApprove={(token) => {
            setPaying({ refund: approval, approval: token });
            setApproval(null);
          }}
        />
      )}
      {refundError && (
        <Sheet title="Vratka" onClose={() => setRefundError(null)}>
          <p role="alert" className="rounded-xl bg-danger-50 p-3 text-danger-600">
            {refundError}
          </p>
          <button type="button" className="btn-secondary mt-4 w-full" onClick={() => setRefundError(null)}>
            Zavřít
          </button>
        </Sheet>
      )}
      {paying?.refund && (
        <p className="sr-only" aria-live="polite">
          Vratka tržby {paying.refund.source.sequence} na {kc(Math.abs(paying.refund.draft.total))}
        </p>
      )}
    </div>
  );
}
