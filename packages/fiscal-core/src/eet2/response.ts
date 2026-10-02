/**
 * Zpracování odpovědi EET 2.0 (server-only).
 *
 * POK přijmeme jen tehdy, když:
 *  1. XML podpis odpovědi (exc-c14n, RSA-SHA256) sedí a podepsaná je právě soapenv:Body,
 *  2. podpisový certifikát vede k připnuté kotvě důvěry daného prostředí a patří GFŘ
 *     (organizationIdentifier NTRCZ-72080043, keyUsage digitalSignature + nonRepudiation),
 *  3. sedí uuid_zpravy a příznaky prostředí (Playground: test=true a POK končí "-ff").
 * Údaje (POK) čteme z PODEPSANÉHO obsahu, ne z původního dokumentu (ochrana proti XML wrapping).
 */
import { X509Certificate } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { EET_NS, isPok, type EetEnvironment } from "./message.ts";
import * as anchors from "./trust-anchors.ts";
import type { EetWarning } from "../transport.ts";

const MAX_BODY_BYTES = 256 * 1024;

export interface ParsedOdpoved {
  uuid: string | null;
  receivedAt: string | null;
  rejectedAt: string | null;
  pok: string | null;
  test: boolean;
  error: { code: number; text: string } | null;
  warnings: EetWarning[];
}

type El = Element;

function children(el: El, ns: string, name: string): El[] {
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as El).namespaceURI === ns && (n as El).localName === name) out.push(n as El);
  }
  return out;
}

function parseXml(xml: string): Document {
  if (xml.length > MAX_BODY_BYTES) throw new Error("Odpověď je příliš velká");
  if (/<!DOCTYPE/i.test(xml)) throw new Error("DTD v odpovědi není povoleno");
  const errors: string[] = [];
  const doc = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: (msg: string) => errors.push(msg),
      fatalError: (msg: string) => errors.push(msg),
    },
  }).parseFromString(xml, "text/xml");
  if (errors.length || !doc.documentElement) throw new Error(`Neplatné XML odpovědi: ${errors[0] ?? "prázdné"}`);
  return doc as unknown as Document;
}

/** Najde eet:Odpoved v elementu Body a přečte ji. */
export function parseOdpoved(bodyOrDoc: El | Document): ParsedOdpoved {
  const root = "documentElement" in bodyOrDoc ? bodyOrDoc.documentElement! : bodyOrDoc;
  const odpoved = root.getElementsByTagNameNS(EET_NS.v4, "Odpoved")[0];
  if (!odpoved) throw new Error("Odpověď neobsahuje element Odpoved");
  const h = children(odpoved, EET_NS.v4, "Hlavicka")[0];
  const pot = children(odpoved, EET_NS.v4, "Potvrzeni")[0];
  const chyba = children(odpoved, EET_NS.v4, "Chyba")[0];
  return {
    uuid: h?.getAttribute("uuid_zpravy") || null,
    receivedAt: h?.getAttribute("dat_prij") || null,
    rejectedAt: h?.getAttribute("dat_odmit") || null,
    pok: pot?.getAttribute("pok") || null,
    test: (pot ?? chyba)?.getAttribute("test") === "true",
    error: chyba ? { code: Number(chyba.getAttribute("kod")), text: (chyba.textContent ?? "").trim() } : null,
    warnings: children(odpoved, EET_NS.v4, "Varovani").map((v) => ({
      code: Number(v.getAttribute("kod_varov")),
      text: (v.textContent ?? "").trim(),
    })),
  };
}

export interface TrustPolicy {
  environment: EetEnvironment;
  /** kotvy: [mezilehlá CA, kořenová CA] */
  chain: X509Certificate[];
}

export function defaultTrustPolicy(environment: EetEnvironment): TrustPolicy {
  return environment === "playground"
    ? { environment, chain: [new X509Certificate(anchors.playgroundIntermediate), new X509Certificate(anchors.playgroundRoot)] }
    : { environment, chain: [new X509Certificate(anchors.productionIntermediate), new X509Certificate(anchors.productionRoot)] };
}

function verifyChain(leaf: X509Certificate, policy: TrustPolicy, at: Date): string | null {
  const [intermediate, root] = policy.chain;
  if (!intermediate || !root) return "chybí kotvy důvěry";
  const inValidity = (c: X509Certificate) => new Date(c.validFrom) <= at && at <= new Date(c.validTo);
  if (!inValidity(leaf)) return "podpisový certifikát FS je mimo dobu platnosti";
  if (!leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) return "podpisový certifikát nevydala očekávaná CA";
  if (!intermediate.checkIssued(root) || !intermediate.verify(root.publicKey)) return "neplatný řetězec CA";
  if (!inValidity(intermediate)) return "mezilehlá CA je mimo dobu platnosti";
  return null;
}

/** Odpovědi podepisuje Generální finanční ředitelství (IČO 72080043). Jiný certifikát od stejné CA nestačí. */
export const FS_SIGNER_ORGANIZATION_ID = "NTRCZ-72080043";

function verifySigner(derB64: string): string | null {
  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.decode64(derB64.replace(/\s+/g, ""))));
  } catch {
    return "podpisový certifikát FS nelze přečíst";
  }
  const orgId = cert.subject.attributes.find((a) => a.type === "2.5.4.97")?.value;
  if (orgId !== FS_SIGNER_ORGANIZATION_ID) return "odpověď nepodepsala Finanční správa (GFŘ)";
  const ku = cert.getExtension("keyUsage") as { digitalSignature?: boolean; nonRepudiation?: boolean } | undefined;
  if (!ku?.digitalSignature || !ku.nonRepudiation) return "podpisový certifikát FS nemá oprávnění k elektronickému podpisu";
  return null;
}

function derToPem(b64: string): string {
  return `-----BEGIN CERTIFICATE-----\n${b64.replace(/\s+/g, "").match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----\n`;
}

export type VerifiedResponse =
  | { kind: "confirmed"; parsed: ParsedOdpoved; signer: string }
  | { kind: "error"; parsed: ParsedOdpoved }
  | { kind: "invalid"; reason: string };

/**
 * Ověří odpověď. Chybové odpovědi (Chyba) FS nepodepisuje — vrátíme je jako "error",
 * nikdy však nepovažujeme jejich obsah za potvrzení tržby.
 */
export function verifyResponse(xml: string, opts: { expectedUuid: string; policy: TrustPolicy; now?: Date }): VerifiedResponse {
  let doc: Document;
  try {
    doc = parseXml(xml);
  } catch (e) {
    return { kind: "invalid", reason: e instanceof Error ? e.message : String(e) };
  }

  let unsigned: ParsedOdpoved;
  try {
    unsigned = parseOdpoved(doc);
  } catch (e) {
    return { kind: "invalid", reason: e instanceof Error ? e.message : String(e) };
  }
  if (unsigned.error) {
    if (unsigned.uuid && unsigned.uuid !== opts.expectedUuid) return { kind: "invalid", reason: "UUID chybové odpovědi nesouhlasí" };
    return { kind: "error", parsed: unsigned };
  }

  const signatures = doc.getElementsByTagNameNS(EET_NS.ds, "Signature");
  const tokens = doc.getElementsByTagNameNS(EET_NS.wsse, "BinarySecurityToken");
  if (signatures.length !== 1 || tokens.length !== 1) return { kind: "invalid", reason: "odpověď nemá právě jeden podpis" };

  let leaf: X509Certificate;
  try {
    leaf = new X509Certificate(Buffer.from((tokens[0]!.textContent ?? "").replace(/\s+/g, ""), "base64"));
  } catch {
    return { kind: "invalid", reason: "nečitelný podpisový certifikát" };
  }
  const chainError = verifyChain(leaf, opts.policy, opts.now ?? new Date());
  if (chainError) return { kind: "invalid", reason: chainError };
  const signerError = verifySigner(tokens[0]!.textContent ?? "");
  if (signerError) return { kind: "invalid", reason: signerError };

  const body = doc.getElementsByTagNameNS(EET_NS.soapenv, "Body")[0];
  const bodyId = body?.getAttributeNS(EET_NS.wsu, "Id");
  if (!body || !bodyId) return { kind: "invalid", reason: "Body nemá wsu:Id" };

  const sig = new SignedXml({ publicCert: derToPem(tokens[0]!.textContent ?? ""), idMode: "wssecurity", getCertFromKeyInfo: () => null });
  try {
    sig.loadSignature(signatures[0]! as unknown as Node);
    if (!sig.checkSignature(xml)) return { kind: "invalid", reason: "neplatný XML podpis odpovědi" };
  } catch (e) {
    return { kind: "invalid", reason: `neplatný XML podpis odpovědi: ${e instanceof Error ? e.message : e}` };
  }
  const refs = sig.getSignedReferences();
  if (refs.length !== 1) return { kind: "invalid", reason: "podpis musí pokrývat právě jeden element" };
  const references = sig.getReferences();
  if (references.length !== 1 || references[0]!.uri !== `#${bodyId}`) return { kind: "invalid", reason: "podpis nepokrývá Body" };
  if (sig.signatureAlgorithm !== "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256") return { kind: "invalid", reason: "neočekávaný podpisový algoritmus" };

  // Data čteme výhradně z podepsaného (kanonizovaného) Body.
  let parsed: ParsedOdpoved;
  try {
    const signedBody = parseXml(refs[0]!).documentElement!;
    if (signedBody.namespaceURI !== EET_NS.soapenv || signedBody.localName !== "Body") return { kind: "invalid", reason: "podepsaný element není Body" };
    parsed = parseOdpoved(signedBody);
  } catch (e) {
    return { kind: "invalid", reason: e instanceof Error ? e.message : String(e) };
  }

  if (parsed.uuid !== opts.expectedUuid) return { kind: "invalid", reason: "UUID odpovědi nesouhlasí s odeslanou zprávou" };
  if (!parsed.pok || !isPok(parsed.pok)) return { kind: "invalid", reason: "odpověď neobsahuje platný POK" };
  const playground = opts.policy.environment === "playground";
  if (playground && (!parsed.test || !parsed.pok.toLowerCase().endsWith("-ff"))) return { kind: "invalid", reason: "odpověď Playgroundu nemá testovací příznaky" };
  if (!playground && (parsed.test || parsed.pok.toLowerCase().endsWith("-ff"))) return { kind: "invalid", reason: "produkční odpověď má testovací příznaky" };

  return { kind: "confirmed", parsed, signer: leaf.subject.replace(/\n/g, ", ") };
}
