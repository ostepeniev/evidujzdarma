"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getConfig, getDevice, getMeta, pruneOld, rejectedSales, setMeta, deleteMeta, unsettledSales } from "@/lib/pos/db";
import { createLocalSale, refundInput } from "@/lib/pos/sale-factory";
import { DeviceRevokedError, configVersion, isConfigStale, onSyncChange, refreshConfig, startAutoSync, syncNow } from "@/lib/pos/sync";
import type { DeviceCredentials, LocalSale, PosConfig } from "@/lib/pos/types";
import { HistoryView, SummaryView } from "./history-view";
import { PaymentSheet, type PaymentResult } from "./payment-sheet";
import { OwnerApproval } from "./owner-approval";
import { PinLock } from "./pin-lock";
import { ReceiptView } from "./receipt-view";
import { RegisterScreen, type CartLine } from "./register-screen";
import { StatusBar } from "./status-bar";
import { kc } from "./ui";

type Phase = "loading" | "unregistered" | "revoked" | "locked" | "ready";
type View = "register" | "history" | "summary";
interface Staff {
  id: string;
  name: string;
}

const AUTO_LOCK_MS = 15 * 60_000;

export function PosApp() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [device, setDevice] = useState<DeviceCredentials | null>(null);
  const [config, setConfig] = useState<PosConfig | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [view, setView] = useState<View>("register");
  const [unitId, setUnitId] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paying, setPaying] = useState<null | { refundOf: LocalSale | null; approval?: string | null }>(null);
  const [approval, setApproval] = useState<LocalSale | null>(null);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptFrom, setReceiptFrom] = useState<View>("register");

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
          setPhase("revoked");
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
  }, [applyConfig]);

  // Konfigurace se mění v nastavení → načíst při návratu do aplikace
  useEffect(() => {
    if (!device) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const cfg = await refreshConfig();
        if (cfg) applyConfig(cfg, device);
      } catch (e) {
        if (e instanceof DeviceRevokedError) setPhase("revoked");
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [device, applyConfig]);

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

  // Aktivita obsluhy prodlužuje přihlášení
  useEffect(() => {
    if (phase !== "ready" || !staff || !config || !needsLock(config)) return;
    const touch = () => void setMeta("activeStaff", { staff, at: Date.now() });
    touch();
    window.addEventListener("pointerdown", touch);
    return () => window.removeEventListener("pointerdown", touch);
  }, [phase, staff, config]);

  async function pay(r: PaymentResult) {
    if (!device || !config) return;
    setBusy(true);
    setPayError(null);
    try {
      const refund = paying?.refundOf ?? null;
      let sale: LocalSale;
      if (refund) {
        const inp = refundInput(refund);
        sale = await createLocalSale(device, config, {
          lines: inp.lines,
          payments: [{ method: r.method, amount: inp.payments[0]!.amount }],
          discount: 0,
          tip: 0,
          cashReceived: null,
          refundOf: refund.id,
          approval: paying?.approval ?? null,
          unitId: refund.unitId,
          staff,
        });
      } else {
        const gross = cart.reduce((s, l) => s + Math.round(l.qty * l.unitPrice), 0);
        const due = gross - discount + r.tip;
        sale = await createLocalSale(device, config, {
          lines: cart.map(({ key: _key, ...l }) => l),
          payments: [{ method: r.method, amount: due }],
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
      void syncNow().catch((e) => e instanceof DeviceRevokedError && setPhase("revoked"));
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Tržbu se nepodařilo uložit");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") return <p className="p-10 text-center text-muted">Načítám pokladnu…</p>;

  if (phase === "unregistered" || phase === "revoked")
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{phase === "revoked" ? "Toto zařízení bylo odpojeno" : "Tohle zařízení zatím není pokladna"}</h1>
        <p className="mt-3 text-ink-soft">
          {phase === "revoked"
            ? "Vlastník účtu zařízení odpojil v nastavení. Přihlaste se a zaregistrujte ho znovu."
            : "Přihlaste se e-mailem, nastavte firmu a evidenční jednotku a toto zařízení zaregistrujte jako pokladnu. Zabere to asi 15 minut."}
        </p>
        <Link href="/pokladna/nastaveni" className="btn-primary mt-6">
          Nastavit pokladnu
        </Link>
        {phase === "revoked" && (
          <button
            type="button"
            className="mt-3 block w-full text-sm text-muted underline"
            onClick={async () => {
              // neodeslané tržby zůstanou v zařízení, ale odejdou až po nové registraci (A r1 nové Дрібне 6)
              const waiting = (await unsettledSales()).length + (await rejectedSales()).length;
              if (waiting && !window.confirm(`V zařízení ${waiting === 1 ? "je 1 neodeslaná tržba" : `je ${waiting} neodeslaných tržeb`}. Zůstanou uložené, ale Finanční správě se odešlou až po nové registraci pokladny. Pokračovat?`)) return;
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
          Účet je zrušený. Pokladna už neprodává – jen odešle tržby, které jsou v ní uložené.
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
              // vratku vždy schvaluje vlastník PINem ověřeným na serveru (R1.7, R3.10)
              setApproval(s);
            }}
          />
        ) : view === "history" ? (
          <HistoryView
            onOpen={(id) => {
              setReceiptFrom("history");
              setReceiptId(id);
            }}
          />
        ) : view === "summary" ? (
          <SummaryView config={config} staff={staff} />
        ) : (
          <RegisterScreen config={config} cart={cart} setCart={setCart} discount={discount} setDiscount={setDiscount} onPay={() => (setPayError(null), setPaying({ refundOf: null }))} />
        )}
      </main>

      {paying && (
        <PaymentSheet
          total={paying.refundOf ? -paying.refundOf.subtotal : cart.reduce((s, l) => s + Math.round(l.qty * l.unitPrice), 0) - discount}
          config={config}
          sequenceHint={device.sequencePrefix}
          busy={busy}
          error={payError}
          onClose={() => setPaying(null)}
          onPay={pay}
        />
      )}
      {approval && (
        <OwnerApproval
          config={config}
          refund={{ refundOf: approval.id, amount: -refundInput(approval).payments[0]!.amount }}
          onClose={() => setApproval(null)}
          onApprove={(token) => {
            setPaying({ refundOf: approval, approval: token });
            setApproval(null);
          }}
        />
      )}
      {paying?.refundOf && (
        <p className="sr-only" aria-live="polite">
          Vratka tržby {paying.refundOf.sequence} na {kc(paying.refundOf.subtotal)}
        </p>
      )}
    </div>
  );
}
