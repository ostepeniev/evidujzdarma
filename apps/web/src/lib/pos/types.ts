import type { Payment, SaleLine } from "@ez/fiscal-core";

export type PosMode = "mock" | "playground" | "production";

export interface DeviceCredentials {
  token: string;
  deviceId: string;
  registerId: string;
  sequencePrefix: string;
  unitId: string | null;
  registeredAt: string;
}

export interface PosConfig {
  fetchedAt: string;
  device: { id: string; name: string; registerId: string; sequencePrefix: string; unitId: string | null };
  account: {
    id: string;
    name: string;
    ico: string | null;
    dic: string | null;
    vatPayer: boolean;
    iban: string | null;
    receiptHeader: string | null;
    receiptFooter: string | null;
    /** chybí u konfigurace uložené starší verzí → bereme jako true */
    receiptShowPok?: boolean;
    mode: PosMode;
    plan: string;
  };
  units: { id: string; label: string; type: string; fsUnitId: number | null; active: boolean; address: string | null }[];
  /** pinHash jen u pokladních; PIN vlastníka se ověřuje online (onlinePin) – R3.10 */
  staff: { id: string; name: string; role: string; pinHash: string | null; onlinePin?: boolean }[];
  catalog: { id: string; name: string; price: number; vatRate: number; color: string | null }[];
  /** poslední uzávěrka tohoto zařízení na serveru (záloha pro případ smazaných dat v prohlížeči) */
  lastClosing?: { id: string; number: number; closedAt: string; closingCash: number } | null;
}

/** Stav tržby v zařízení. "local" = ještě nedorazila na server. */
export type LocalStatus = "local" | "queued" | "sending" | "confirmed" | "rejected" | "not_required" | "failed";

export interface LocalSale {
  id: string;
  sequence: string;
  soldAt: string;
  unitId: string;
  unitLabel: string;
  staffId: string | null;
  staffName: string | null;
  /** položky tak, jak je zadala obsluha (před slevou) */
  lines: SaleLine[];
  payments: Payment[];
  discount: number;
  tip: number;
  refundOf: string | null;
  subtotal: number;
  total: number;
  vat: Record<string, { base: number; vat: number }> | null;
  cashReceived: number | null;
  mode: PosMode;
  /** schválení vratky vlastníkem vydané serverem po ověření jeho PINu (R3.10) */
  approval?: string | null;
  status: LocalStatus;
  confirmationCode: string | null;
  error: string | null;
  /** server tržbu uložil do karantény (čeká na vlastníka) */
  quarantined?: boolean;
  /** vlastník tržbu z karantény vyřídil ručně (např. evidence v MOJE eet, zkouška) – už není „k vyřízení“ (R5.7) */
  resolution?: "dismissed";
  syncedAt: string | null;
  createdAt: string;
}

export interface LocalCashMovement {
  id: string;
  at: string;
  type: "deposit" | "withdrawal";
  amount: number;
  note: string | null;
  staffId: string | null;
  staffName: string | null;
  syncedAt: string | null;
}

export interface LocalClosing {
  id: string;
  number: number;
  periodFrom: string | null;
  closedAt: string;
  totals: import("@ez/fiscal-core").ClosingTotals;
  denominations: Record<string, number> | null;
  note: string | null;
  staffId: string | null;
  staffName: string | null;
  mode: PosMode;
  unitLabel: string | null;
  syncedAt: string | null;
}
