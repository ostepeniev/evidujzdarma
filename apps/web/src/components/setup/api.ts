"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown,
  ) {
    super(message);
  }
}

export async function call<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Chyba ${res.status}`, res.status, data);
  return data as T;
}

export interface AccountStateDto {
  user: { email: string };
  /** účet ještě není: IČO z předregistrace se stejným e-mailem (R17.3) */
  preregIco?: string | null;
  /** IČO z kontroly IČO (?ico= v adrese nastavení, R18.1) – má přednost před předregistrací */
  checkIco?: string | null;
  account: null | {
    id: string;
    name: string;
    ico: string | null;
    dic: string | null;
    eic: string | null;
    vatPayer: boolean;
    iban: string | null;
    receiptHeader: string | null;
    receiptFooter: string | null;
    receiptShowPok: boolean;
    eetMode: string;
    plan: string;
    closedAt: string | null;
  };
  limits?: { staff: number; units: number; devices: number };
  units?: { id: string; type: string; label: string; fsUnitId: number | null; address: string | null; active: boolean }[];
  staff?: { id: string; name: string; role: string; active: boolean; hasPin: boolean }[];
  catalog?: { id: string; name: string; price: number; vatRate: number; color: string | null; active: boolean }[];
  devices?: { id: string; name: string; registerId: string; unitId: string | null; lastSeenAt: string | null }[];
  certificates?: { id: string; subject: string; eic: string | null; environment: string; validFrom: string; validTo: string; verifiedAt: string | null }[];
  /** zrušený účet: kdy nejpozději smažeme data a co ještě čeká (R6.4) */
  closure?: {
    held: boolean;
    deleteBy: string;
    devicesOffAt: string;
    unsentProduction: number;
    quarantineProduction: number;
    /** id zobrazených neodeslaných ostrých tržeb a karantény – „Evidováno jinak“ potvrdí jen je (R7.12); dlouhý seznam: null */
    unsentIds: string[] | null;
    /** prvních 20 neodeslaných ostrých tržeb */
    unsentSales: { id: string; soldAt: string; total: number; registerId: string; sequence: string }[];
    /** dlouhý seznam: co vlastník viděl – počet a čas posledního přijetí (R8.7 N16) */
    unsentSeen: { count: number; lastAt: string | null };
    unsentPlayground: number;
  } | null;
  salesCount?: number;
  accountants?: { id: string; name: string }[];
}

export const UNIT_TYPE_LABEL: Record<string, string> = {
  stala_provozovna: "Stálá provozovna",
  mobilni_provozovna: "Mobilní provozovna",
  automat: "Automat",
  internetova_stranka: "Internetová stránka",
  dopravni_prostredek: "Dopravní prostředek",
  osoba: "Podnikatel bez provozovny (já sám)",
};
