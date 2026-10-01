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
    mode: PosMode;
    plan: string;
  };
  units: { id: string; label: string; type: string; fsUnitId: number | null; active: boolean; address: string | null }[];
  staff: { id: string; name: string; role: string; pinHash: string | null }[];
  catalog: { id: string; name: string; price: number; vatRate: number; color: string | null }[];
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
  status: LocalStatus;
  confirmationCode: string | null;
  error: string | null;
  syncedAt: string | null;
  createdAt: string;
}
