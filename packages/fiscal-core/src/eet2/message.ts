/**
 * Datová zpráva EET 2.0 (XSD v4.1, namespace http://fs.gov.cz/eet/schema/v4).
 * Isomorfní: sestavení a kanonická XML bez kryptografie.
 */
import { decimalString } from "../money.ts";
import { evidencedAmounts, type Sale } from "../sale.ts";

export const EET_NS = {
  soapenv: "http://schemas.xmlsoap.org/soap/envelope/",
  v4: "http://fs.gov.cz/eet/schema/v4",
  wsse: "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd",
  wsu: "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd",
  ds: "http://www.w3.org/2000/09/xmldsig#",
  ec: "http://www.w3.org/2001/10/xml-exc-c14n#",
} as const;

export const EET_ENDPOINTS = {
  playground: "https://pg.trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4",
  production: "https://trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4",
} as const;

export const SOAP_ACTION = "http://fs.gov.cz/eet/OdeslaniTrzby";

export type EetEnvironment = keyof typeof EET_ENDPOINTS;

export interface EetHeader {
  uuid_zpravy: string;
  dat_odesl: string;
  prvni_zaslani: boolean;
  overeni?: boolean;
}

export interface EetData {
  eic_popl: string;
  eic_poverujiciho?: string;
  povereni_vice_popl?: boolean;
  id_jednotky: number;
  id_pokl: string;
  porad_cis: string;
  dat_trzby: string;
  celk_trzba: string;
  urceno_cerp_zuct?: string;
  cerp_zuct?: string;
}

export interface EetMessage {
  header: EetHeader;
  data: EetData;
}

export class EetMessageError extends Error {
  constructor(readonly issues: string[]) {
    super(`Neplatná datová zpráva: ${issues.join("; ")}`);
  }
}

/** Patterny přímo z EETXMLSchema.xsd v4.1 */
const P = {
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/,
  eic: /^CZ[0-9]{8,10}$/,
  string20: /^[0-9a-zA-Z.,:;/#\-_ ]{1,20}$/,
  string25: /^[0-9a-zA-Z.,:;/#\-_ ]{1,25}$/,
  dateTime: /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(Z|[+-]\d\d:\d\d)$/,
  castka: /^((0|-?[1-9]\d{0,7})\.\d\d|-0\.(0[1-9]|[1-9]\d))$/,
  unit: /^[1-9][0-9]{0,8}$/,
  pok: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}-[0-9a-fA-F]{2}$/,
};

export function isPok(value: string): boolean {
  return value.length === 39 && P.pok.test(value);
}

/** "2027-01-15T10:30:00Z" — XSD nepovoluje zlomky sekund. */
export function formatEetDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export interface BuildOptions {
  eic: string;
  delegatingEic?: string | null;
  multiDelegation?: boolean;
  messageUuid: string;
  sentAt: Date;
  firstAttempt: boolean;
  verifyOnly: boolean;
}

export function buildEetMessage(sale: Pick<Sale, "unitId" | "registerId" | "sequence" | "soldAt" | "payments" | "lines">, o: BuildOptions): EetMessage {
  const amounts = evidencedAmounts(sale);
  const msg: EetMessage = {
    header: {
      uuid_zpravy: o.messageUuid,
      dat_odesl: formatEetDateTime(o.sentAt),
      prvni_zaslani: o.firstAttempt,
      overeni: o.verifyOnly,
    },
    data: {
      eic_popl: o.eic,
      ...(o.delegatingEic ? { eic_poverujiciho: o.delegatingEic } : {}),
      ...(o.multiDelegation ? { povereni_vice_popl: true } : {}),
      id_jednotky: Number(sale.unitId),
      id_pokl: sale.registerId,
      porad_cis: sale.sequence,
      dat_trzby: formatEetDateTime(sale.soldAt),
      celk_trzba: decimalString(amounts.total),
      ...(amounts.prepayment ? { urceno_cerp_zuct: decimalString(amounts.prepayment) } : {}),
      ...(amounts.redeemed ? { cerp_zuct: decimalString(amounts.redeemed) } : {}),
    },
  };
  const issues = validateEetMessage(msg);
  if (issues.length) throw new EetMessageError(issues);
  return msg;
}

export function validateEetMessage(m: EetMessage): string[] {
  const issues: string[] = [];
  const h = m.header;
  const d = m.data;
  if (!P.uuid.test(h.uuid_zpravy)) issues.push("uuid_zpravy");
  if (!P.dateTime.test(h.dat_odesl)) issues.push("dat_odesl");
  if (!P.eic.test(d.eic_popl)) issues.push("eic_popl (EIČ musí být CZ + 8–10 číslic)");
  if (d.eic_poverujiciho !== undefined && !P.eic.test(d.eic_poverujiciho)) issues.push("eic_poverujiciho");
  if (!P.unit.test(String(d.id_jednotky))) issues.push("id_jednotky (číslo evidenční jednotky z DIS+)");
  if (!P.string20.test(d.id_pokl)) issues.push("id_pokl (max. 20 znaků)");
  if (!P.string25.test(d.porad_cis)) issues.push("porad_cis (max. 25 znaků)");
  if (!P.dateTime.test(d.dat_trzby)) issues.push("dat_trzby");
  for (const k of ["celk_trzba", "urceno_cerp_zuct", "cerp_zuct"] as const) {
    const v = d[k];
    if (v !== undefined && !P.castka.test(v)) issues.push(k);
  }
  return issues;
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/\t/g, "&#x9;").replace(/\n/g, "&#xA;").replace(/\r/g, "&#xD;");
}

/** Atributy seřazené podle jména — pravidlo kanonikalizace pro atributy bez namespace. */
function attrs(o: object): string {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
    .join("");
}

/**
 * Exclusive C14N (InclusiveNamespaces "v4") elementu soapenv:Body tak, jak ho
 * serializuje `buildEnvelope`. Ověřeno proti oficiálnímu podepsanému vzorku FS.
 */
export function canonicalBody(m: EetMessage, bodyId: string): string {
  return (
    `<soapenv:Body xmlns:soapenv="${EET_NS.soapenv}" xmlns:v4="${EET_NS.v4}" xmlns:wsu="${EET_NS.wsu}" wsu:Id="${esc(bodyId)}">` +
    `<v4:Trzba><v4:Hlavicka${attrs(m.header)}></v4:Hlavicka><v4:Data${attrs(m.data)}></v4:Data></v4:Trzba></soapenv:Body>`
  );
}

function signedInfoInner(bodyId: string, digestB64: string): string {
  return (
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"><ec:InclusiveNamespaces xmlns:ec="${EET_NS.ec}" PrefixList="soapenv v4"></ec:InclusiveNamespaces></ds:CanonicalizationMethod>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></ds:SignatureMethod>` +
    `<ds:Reference URI="#${esc(bodyId)}"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"><ec:InclusiveNamespaces xmlns:ec="${EET_NS.ec}" PrefixList="v4"></ec:InclusiveNamespaces></ds:Transform></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod><ds:DigestValue>${digestB64}</ds:DigestValue></ds:Reference>`
  );
}

/** Exclusive C14N (InclusiveNamespaces "soapenv v4") elementu ds:SignedInfo — to se podepisuje. */
export function canonicalSignedInfo(bodyId: string, digestB64: string): string {
  return `<ds:SignedInfo xmlns:ds="${EET_NS.ds}" xmlns:soapenv="${EET_NS.soapenv}" xmlns:v4="${EET_NS.v4}">${signedInfoInner(bodyId, digestB64)}</ds:SignedInfo>`;
}

export interface EnvelopeParts {
  message: EetMessage;
  ids: { body: string; token: string; signature: string; keyInfo: string; str: string };
  certificateDerBase64: string;
  digestB64: string;
  signatureB64: string;
}

/** Kompletní SOAP obálka s WS-Security podpisem (struktura shodná s oficiálním vzorkem). */
export function buildEnvelope(p: EnvelopeParts): string {
  const { ids } = p;
  return (
    `<soapenv:Envelope xmlns:soapenv="${EET_NS.soapenv}" xmlns:v4="${EET_NS.v4}"><soapenv:Header>` +
    `<wsse:Security xmlns:wsse="${EET_NS.wsse}" xmlns:wsu="${EET_NS.wsu}">` +
    `<wsse:BinarySecurityToken EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" wsu:Id="${esc(ids.token)}">${p.certificateDerBase64}</wsse:BinarySecurityToken>` +
    `<ds:Signature Id="${esc(ids.signature)}" xmlns:ds="${EET_NS.ds}"><ds:SignedInfo>${signedInfoInner(ids.body, p.digestB64)}</ds:SignedInfo>` +
    `<ds:SignatureValue>${p.signatureB64}</ds:SignatureValue>` +
    `<ds:KeyInfo Id="${esc(ids.keyInfo)}"><wsse:SecurityTokenReference wsu:Id="${esc(ids.str)}"><wsse:Reference URI="#${esc(ids.token)}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/></wsse:SecurityTokenReference></ds:KeyInfo>` +
    `</ds:Signature></wsse:Security></soapenv:Header>` +
    `<soapenv:Body wsu:Id="${esc(ids.body)}" xmlns:wsu="${EET_NS.wsu}"><v4:Trzba><v4:Hlavicka${attrs(p.message.header)}/><v4:Data${attrs(p.message.data)}/></v4:Trzba></soapenv:Body>` +
    `</soapenv:Envelope>`
  );
}
