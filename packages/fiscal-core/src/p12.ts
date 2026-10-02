/**
 * Načtení certifikátu pro evidenci tržeb z PKCS#12 (.p12 / .pfx).
 * Server-only (node-forge + node:crypto).
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import forge from "node-forge";

export interface CertificateInfo {
  subject: string;
  commonName: string | null;
  /** DIČ nalezené v subjektu (CN nebo serialNumber), pokud tam je */
  dic: string | null;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  /** OID z rozšíření certificatePolicies – podle nich se pozná prostředí EET 2.0 (R5.9) */
  policies: string[];
}

export interface LoadedCertificate {
  info: CertificateInfo;
  privateKeyPem: string;
  certificatePem: string;
  /** DER certifikátu v base64 — pro BinarySecurityToken / x5c */
  certificateDerBase64: string;
}

export class CertificateError extends Error {}

function dn(attrs: forge.pki.CertificateField[]): string {
  return attrs.map((a) => `${a.shortName ?? a.name ?? a.type}=${a.value}`).join(", ");
}

function p12Error(e: unknown): CertificateError {
  const msg = e instanceof Error ? e.message : String(e);
  if (/mac|password|invalid/i.test(msg)) return new CertificateError("Nesprávné heslo k certifikátu nebo poškozený soubor.");
  return new CertificateError("Soubor není platný certifikát ve formátu .p12/.pfx.");
}

const OID_SHROUDED = "1.2.840.113549.1.12.10.1.2";
const OID_KEY = "1.2.840.113549.1.12.10.1.1";
const OID_CERT = "1.2.840.113549.1.12.10.1.3";

/** Parsování v aktuálním vlákně. Na serveru používejte parseP12Safe (limity + worker s časovým limitem). */
export function parseP12(data: Buffer | Uint8Array, password: string): LoadedCertificate {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const der = forge.util.createBuffer(Buffer.from(data).toString("binary"));
    const asn1 = forge.asn1.fromDer(der);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch (e) {
    throw p12Error(e);
  }
  const keyBags: forge.pkcs12.Bag[] = [
    ...(p12.getBags({ bagType: OID_SHROUDED })[OID_SHROUDED] ?? []),
    ...(p12.getBags({ bagType: OID_KEY })[OID_KEY] ?? []),
  ];
  const certBags: forge.pkcs12.Bag[] = p12.getBags({ bagType: OID_CERT })[OID_CERT] ?? [];
  const key = keyBags.find((b) => b.key)?.key as forge.pki.rsa.PrivateKey | undefined;
  const certs = certBags.map((b) => b.cert).filter((c): c is forge.pki.Certificate => !!c);
  return assemble(key, certs);
}

const OID_CERT_POLICIES = "2.5.29.32";

/** certificatePolicies: SEQUENCE OF PolicyInformation { policyIdentifier OID, … } – forge ho nerozebírá. */
function certificatePolicies(cert: forge.pki.Certificate): string[] {
  const ext = (cert.extensions as { id?: string; value?: unknown }[] | undefined)?.find((e) => e.id === OID_CERT_POLICIES);
  if (!ext || typeof ext.value !== "string") return [];
  try {
    const seq = forge.asn1.fromDer(ext.value);
    return (seq.value as forge.asn1.Asn1[])
      .map((pi) => (pi.value as forge.asn1.Asn1[])[0])
      .filter((oid): oid is forge.asn1.Asn1 => !!oid && oid.type === forge.asn1.Type.OID)
      .map((oid) => forge.asn1.derToOid(oid.value as string));
  } catch {
    return [];
  }
}

function assemble(key: forge.pki.rsa.PrivateKey | undefined, certs: forge.pki.Certificate[]): LoadedCertificate {
  if (!key) throw new CertificateError("V souboru chybí privátní klíč.");
  // Vybereme certifikát, jehož veřejný klíč odpovídá privátnímu klíči (soubor může obsahovat i CA řetězec).
  if (!certs.length) throw new CertificateError("V souboru chybí certifikát.");
  const cert = certs.find((c) => {
    const pub = c.publicKey as forge.pki.rsa.PublicKey;
    return pub.n && key.n && pub.n.equals(key.n);
  });
  // klíč a certifikát, které k sobě nepatří, by podepisovaly zprávy, které FS odmítne (A Дрібне 4)
  if (!cert) throw new CertificateError("Certifikát v souboru neodpovídá privátnímu klíči. Stáhněte z DIS+ znovu celý soubor .p12.");

  const cn = cert.subject.getField("CN")?.value ?? null;
  const serialAttr = cert.subject.getField({ name: "serialNumber" })?.value ?? null;
  const dicMatch = [cn, serialAttr]
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.match(/CZ\d{8,10}/)?.[0])
    .find(Boolean);

  const certificatePem = forge.pki.certificateToPem(cert);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();

  return {
    info: {
      subject: dn(cert.subject.attributes),
      commonName: typeof cn === "string" ? cn : null,
      dic: dicMatch ?? null,
      issuer: dn(cert.issuer.attributes),
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
      policies: certificatePolicies(cert),
    },
    privateKeyPem: forge.pki.privateKeyToPem(key),
    certificatePem,
    certificateDerBase64: forge.util.encode64(der),
  };
}

/* ───────────── ochrana proti DoS (R3.1) ───────────── */

export const P12_LIMITS = {
  /** pokladní certifikát má jednotky kB */
  maxBytes: 64 * 1024,
  /** iterace jedné operace (MAC, PBE, PBKDF2); běžné soubory mají 2 048–10 000 */
  maxIterations: 200_000,
  maxTotalIterations: 1_000_000,
  maxOperations: 16,
  timeoutMs: 5_000,
} as const;

const PBKDF2 = "1.2.840.113549.1.5.12";
const PBE_OIDS = new Set([PBKDF2, "1.2.840.113549.1.5.1", "1.2.840.113549.1.5.3", "1.2.840.113549.1.5.4", "1.2.840.113549.1.5.6", "1.2.840.113549.1.5.10", "1.2.840.113549.1.5.11"]);
const isPbe = (oid: string) => PBE_OIDS.has(oid) || oid.startsWith("1.2.840.113549.1.12.1.");

function intValue(node: forge.asn1.Asn1): number {
  const bytes = node.value as string;
  if (bytes.length > 6) return Number.POSITIVE_INFINITY;
  let n = 0;
  for (let i = 0; i < bytes.length; i++) n = n * 256 + bytes.charCodeAt(i);
  return n;
}

/**
 * Najde počty iterací ještě před jakýmkoli odvozováním klíče: MacData a parametry PBE/PBKDF2
 * (i ve vnořených OCTET STRING). Útočník tak nemůže poslat soubor s miliardou iterací.
 */
export function inspectP12(data: Buffer | Uint8Array): { maxIterations: number; totalIterations: number; operations: number } {
  const root = forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(data).toString("binary")));
  const found: number[] = [];
  let nodes = 0;
  const walk = (node: forge.asn1.Asn1, depth: number) => {
    if (++nodes > 50_000 || depth > 24) throw new CertificateError("Soubor certifikátu má neobvyklou strukturu.");
    if (Array.isArray(node.value)) {
      const kids = node.value as forge.asn1.Asn1[];
      const first = kids[0];
      if (first?.type === forge.asn1.Type.OID && isPbe(forge.asn1.derToOid(first.value as string))) {
        const params = kids[1];
        const it = Array.isArray(params?.value) ? (params!.value as forge.asn1.Asn1[]).find((k) => k.type === forge.asn1.Type.INTEGER) : undefined;
        if (it) found.push(intValue(it));
      }
      for (const k of kids) walk(k, depth + 1);
      return;
    }
    if (node.type === forge.asn1.Type.OCTETSTRING && typeof node.value === "string" && node.value.length > 1 && node.value.charCodeAt(0) === 0x30) {
      try {
        walk(forge.asn1.fromDer(forge.util.createBuffer(node.value)), depth + 1);
      } catch (e) {
        if (e instanceof CertificateError) throw e;
      }
    }
  };
  walk(root, 0);
  // MacData ::= SEQUENCE { DigestInfo, macSalt OCTET STRING, iterations INTEGER DEFAULT 1 }
  const mac = Array.isArray(root.value) ? (root.value as forge.asn1.Asn1[])[2] : undefined;
  if (mac && Array.isArray(mac.value)) {
    const it = (mac.value as forge.asn1.Asn1[])[2];
    found.push(it?.type === forge.asn1.Type.INTEGER ? intValue(it) : 1);
  }
  return {
    maxIterations: found.length ? Math.max(...found) : 0,
    totalIterations: found.reduce((a, b) => a + b, 0),
    operations: found.length,
  };
}

const WORKER_SOURCE = `(() => {
const { parentPort, workerData } = require("node:worker_threads");
let forge;
try {
  forge = require(workerData.forgePath);
} catch (e) {
  parentPort.postMessage({ ok: false, loadError: true, message: String((e && e.message) || e) });
  return;
}
try {
  const der = forge.util.createBuffer(Buffer.from(workerData.data).toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, workerData.password);
  const bags = (t) => p12.getBags({ bagType: t })[t] || [];
  const keys = [...bags("${OID_SHROUDED}"), ...bags("${OID_KEY}")].filter((b) => b.key).map((b) => forge.pki.privateKeyToPem(b.key));
  const certs = bags("${OID_CERT}").filter((b) => b.cert).map((b) => forge.pki.certificateToPem(b.cert));
  parentPort.postMessage({ ok: true, keys, certs });
} catch (e) {
  parentPort.postMessage({ ok: false, message: String((e && e.message) || e) });
}
})();
`;

function forgeModulePath(): string | null {
  for (const base of [import.meta.url, pathToFileURL(join(process.cwd(), "index.js")).href]) {
    try {
      return createRequire(base).resolve("node-forge");
    } catch {
      /* zkusíme další */
    }
  }
  return null;
}

/**
 * Bezpečné načtení .p12 na serveru: limit velikosti, kontrola iterací před dešifrováním
 * a parsování ve worker_threads, které se po časovém limitu ukončí.
 */
export async function parseP12Safe(data: Buffer | Uint8Array, password: string, opts: { timeoutMs?: number } = {}): Promise<LoadedCertificate> {
  if (data.length > P12_LIMITS.maxBytes) throw new CertificateError("Soubor je příliš velký – pokladní certifikát má jen pár kB.");
  let scan;
  try {
    scan = inspectP12(data);
  } catch (e) {
    throw e instanceof CertificateError ? e : new CertificateError("Soubor není platný certifikát ve formátu .p12/.pfx.");
  }
  if (scan.maxIterations > P12_LIMITS.maxIterations || scan.totalIterations > P12_LIMITS.maxTotalIterations || scan.operations > P12_LIMITS.maxOperations) {
    throw new CertificateError("Soubor certifikátu má neobvyklé parametry šifrování (příliš mnoho iterací). Vygenerujte certifikát znovu v DIS+.");
  }
  const forgePath = forgeModulePath();
  // bez cesty k node-forge (neobvyklé prostředí) zůstává ochrana předběžnou kontrolou iterací
  if (!forgePath) return parseP12(data, password);
  const timeoutMs = opts.timeoutMs ?? P12_LIMITS.timeoutMs;
  const result = await new Promise<{ ok: true; keys: string[]; certs: string[] } | { ok: false; message: string; loadError?: boolean }>((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { forgePath, data: Buffer.from(data), password }, resourceLimits: { maxOldGenerationSizeMb: 64 } });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new CertificateError("Zpracování certifikátu překročilo časový limit. Zkontrolujte soubor nebo ho vygenerujte znovu."));
    }, timeoutMs);
    worker.once("message", (m) => {
      clearTimeout(timer);
      void worker.terminate();
      resolve(m);
    });
    worker.once("error", (e) => {
      clearTimeout(timer);
      reject(p12Error(e));
    });
  });
  // worker nenašel node-forge (neobvyklé rozložení balíčků) – limity iterací už prošly, parsujeme tady
  if (!result.ok && result.loadError) return parseP12(data, password);
  if (!result.ok) throw p12Error(new Error(result.message));
  return assemble(result.keys[0] ? (forge.pki.privateKeyFromPem(result.keys[0]) as forge.pki.rsa.PrivateKey) : undefined, result.certs.map((c) => forge.pki.certificateFromPem(c)));
}

export function daysUntilExpiry(info: CertificateInfo, now = new Date()): number {
  return Math.floor((info.validTo.getTime() - now.getTime()) / 86_400_000);
}

/** Vytvoří self-signed .p12 — jen pro testy a demo režim. */
export function createTestP12(opts: {
  commonName: string;
  password: string;
  days?: number;
  issuerCommonName?: string;
  notBefore?: Date;
  notAfter?: Date;
  /** Policy OID pokladního certifikátu (R5.9); bez něj certifikát rozšíření certificatePolicies nemá */
  policyOid?: string | null;
}): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01" + forge.util.bytesToHex(forge.random.getBytesSync(8));
  cert.validity.notBefore = opts.notBefore ?? new Date();
  cert.validity.notAfter = opts.notAfter ?? new Date(Date.now() + (opts.days ?? 365) * 86_400_000);
  const attrs = [{ name: "commonName", value: opts.commonName }, { name: "countryName", value: "CZ" }];
  cert.setSubject(attrs);
  cert.setIssuer([{ name: "commonName", value: opts.issuerCommonName ?? "EvidujZdarma TEST CA" }]);
  if (opts.policyOid) {
    const { asn1 } = forge;
    const policy = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(opts.policyOid).getBytes())]),
    ]);
    cert.setExtensions([{ id: OID_CERT_POLICIES, value: policy }]);
  }
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], opts.password, { algorithm: "3des" });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
}
