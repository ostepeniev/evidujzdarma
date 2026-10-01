/**
 * ARES (Administrativní registr ekonomických subjektů) — REST API MF ČR.
 * Dokumentace: https://ares.gov.cz/stranky/vyvojar-info
 *
 * Mapujeme jen pole, která skutečně zobrazujeme; surový JSON si volající může uložit.
 * Parsování je defenzivní — chybějící pole nikdy nevyhodí výjimku.
 */
import { normalizeIco } from "./ico.ts";

export const ARES_BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

export interface Address {
  text: string | null;
  street: string | null;
  city: string | null;
  cityCode: number | null;
  district: string | null;
  postalCode: string | null;
  regionCode: number | null;
  regionName: string | null;
  country: string | null;
}

export interface Subject {
  ico: string;
  name: string;
  legalForm: string | null;
  dic: string | null;
  foundedAt: string | null;
  dissolvedAt: string | null;
  updatedAt: string | null;
  address: Address;
  nace: string[];
  /** stav registrací v jednotlivých zdrojích, např. { rzp: "AKTIVNI", dph: "AKTIVNI" } */
  registrations: Record<string, string>;
  vatPayer: boolean;
}

export interface Establishment {
  /** IČP — identifikační číslo provozovny */
  icp: string;
  name: string | null;
  address: Address;
  startedAt: string | null;
  endedAt: string | null;
  trades: string[];
}

export interface TradeLicence {
  subject: string;
  kind: string | null;
  startedAt: string | null;
  endedAt: string | null;
  fields: string[];
}

export interface RzpRecord {
  trades: TradeLicence[];
  establishments: Establishment[];
}

type Json = Record<string, unknown>;

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function obj(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function mapAddress(raw: unknown): Address {
  const a = obj(raw);
  const houseNo = [str(a.cisloDomovni), str(a.cisloOrientacni)].filter(Boolean).join("/");
  const orientLetter = str(a.cisloOrientacniPismeno) ?? "";
  const streetName = str(a.nazevUlice) ?? str(a.nazevCastiObce);
  const street = streetName ? `${streetName}${houseNo ? ` ${houseNo}${orientLetter}` : ""}` : null;
  const psc = str(a.psc);
  return {
    text: str(a.textovaAdresa),
    street,
    city: str(a.nazevObce),
    cityCode: num(a.kodObce),
    district: str(a.nazevMestskeCastiObvodu) ?? str(a.nazevCastiObce),
    postalCode: psc ? psc.padStart(5, "0") : null,
    regionCode: num(a.kodKraje),
    regionName: str(a.nazevKraje),
    country: str(a.nazevStatu) ?? str(a.kodStatu),
  };
}

export function mapSubject(raw: unknown): Subject {
  const s = obj(raw);
  const regsRaw = obj(s.seznamRegistraci);
  const registrations: Record<string, string> = {};
  for (const [k, v] of Object.entries(regsRaw)) {
    const m = k.match(/^stavZdroje(.+)$/);
    if (m && typeof v === "string") registrations[m[1]!.toLowerCase()] = v;
  }
  const nace = arr(s.czNace)
    .map((c) => str(c))
    .filter((c): c is string => !!c);
  return {
    ico: normalizeIco(str(s.ico) ?? "") ?? "",
    name: str(s.obchodniJmeno) ?? "",
    legalForm: str(s.pravniForma),
    dic: str(s.dic),
    foundedAt: str(s.datumVzniku),
    dissolvedAt: str(s.datumZaniku),
    updatedAt: str(s.datumAktualizace),
    address: mapAddress(s.sidlo),
    nace,
    registrations,
    vatPayer: registrations.dph === "AKTIVNI",
  };
}

/** Projde libovolně vnořený JSON a najde objekty provozoven (pole s IČP). */
function collectEstablishments(node: unknown, trade: string | null, out: Map<string, Establishment>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectEstablishments(item, trade, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Json;
  const icp = str(o.identifikacniCisloProvozovny ?? o.icp ?? o.icpProvozovny);
  if (icp) {
    const existing = out.get(icp);
    if (existing) {
      if (trade && !existing.trades.includes(trade)) existing.trades.push(trade);
    } else {
      out.set(icp, {
        icp,
        name: str(o.nazevProvozovny ?? o.nazev),
        address: mapAddress(o.sidloProvozovny ?? o.adresaProvozovny ?? o.sidlo ?? o.adresa),
        startedAt: str(o.datumZahajeniCinnosti ?? o.datumVzniku ?? o.platnostOd),
        endedAt: str(o.datumUkonceniCinnosti ?? o.datumZaniku ?? o.platnostDo),
        trades: trade ? [trade] : [],
      });
    }
    return;
  }
  const nextTrade = str(o.predmetPodnikani) ?? trade;
  for (const v of Object.values(o)) collectEstablishments(v, nextTrade, out);
}

export function mapRzp(raw: unknown): RzpRecord {
  const root = obj(raw);
  const records = arr(root.zaznamy);
  const primary = obj(records.find((r) => obj(r).primarniZaznam === true) ?? records[0]);
  const trades: TradeLicence[] = arr(primary.zivnosti).map((z) => {
    const t = obj(z);
    return {
      subject: str(t.predmetPodnikani) ?? "",
      kind: str(t.druhZivnosti),
      startedAt: str(t.datumVzniku),
      endedAt: str(t.datumZaniku),
      fields: arr(t.oboryCinnosti)
        .map((f) => str(obj(f).nazev) ?? str(f))
        .filter((f): f is string => !!f),
    };
  });
  const map = new Map<string, Establishment>();
  collectEstablishments(primary, null, map);
  return { trades, establishments: [...map.values()] };
}

export class AresError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface AresClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  userAgent?: string;
}

export class AresClient {
  private readonly base: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(opts: AresClientOptions = {}) {
    this.base = opts.baseUrl ?? ARES_BASE;
    this.fetcher = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8000;
    this.userAgent = opts.userAgent ?? "EvidujZdarma.cz (+https://evidujzdarma.cz)";
  }

  private async request(path: string, init?: RequestInit): Promise<unknown | null> {
    const res = await this.fetcher(`${this.base}${path}`, {
      ...init,
      headers: { accept: "application/json", "user-agent": this.userAgent, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new AresError(`ARES ${res.status} ${path}`, res.status);
    return res.json();
  }

  async rawSubject(ico: string): Promise<unknown | null> {
    const n = normalizeIco(ico);
    if (!n) return null;
    return this.request(`/ekonomicke-subjekty/${n}`);
  }

  async subject(ico: string): Promise<Subject | null> {
    const raw = await this.rawSubject(ico);
    return raw ? mapSubject(raw) : null;
  }

  async rawRzp(ico: string): Promise<unknown | null> {
    const n = normalizeIco(ico);
    if (!n) return null;
    return this.request(`/ekonomicke-subjekty-rzp/${n}`);
  }

  async rzp(ico: string): Promise<RzpRecord | null> {
    const raw = await this.rawRzp(ico);
    return raw ? mapRzp(raw) : null;
  }

  /** Vyhledání podle názvu / sídla. ARES vrací max. 1000 záznamů na dotaz. */
  async search(query: { name?: string; cityCode?: number; nace?: string[]; start?: number; count?: number }) {
    const body: Json = { start: query.start ?? 0, pocet: query.count ?? 20 };
    if (query.name) body.obchodniJmeno = query.name;
    if (query.cityCode) body.sidlo = { kodObce: query.cityCode };
    if (query.nace?.length) body.czNace = query.nace;
    const raw = obj(
      await this.request(`/ekonomicke-subjekty/vyhledat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return {
      total: num(raw.pocetCelkem) ?? 0,
      items: arr(raw.ekonomickeSubjekty).map(mapSubject),
    };
  }
}
