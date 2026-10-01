/**
 * Načtení certifikátu pro evidenci tržeb z PKCS#12 (.p12 / .pfx).
 * Server-only (node-forge + node:crypto).
 */
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

export function parseP12(data: Buffer | Uint8Array, password: string): LoadedCertificate {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const der = forge.util.createBuffer(Buffer.from(data).toString("binary"));
    const asn1 = forge.asn1.fromDer(der);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/mac|password|invalid/i.test(msg)) throw new CertificateError("Nesprávné heslo k certifikátu nebo poškozený soubor.");
    throw new CertificateError("Soubor není platný certifikát ve formátu .p12/.pfx.");
  }

  const OID_SHROUDED = "1.2.840.113549.1.12.10.1.2";
  const OID_KEY = "1.2.840.113549.1.12.10.1.1";
  const OID_CERT = "1.2.840.113549.1.12.10.1.3";
  const keyBags: forge.pkcs12.Bag[] = [
    ...(p12.getBags({ bagType: OID_SHROUDED })[OID_SHROUDED] ?? []),
    ...(p12.getBags({ bagType: OID_KEY })[OID_KEY] ?? []),
  ];
  const certBags: forge.pkcs12.Bag[] = p12.getBags({ bagType: OID_CERT })[OID_CERT] ?? [];
  const key = keyBags.find((b) => b.key)?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!key) throw new CertificateError("V souboru chybí privátní klíč.");

  // Vybereme certifikát, jehož veřejný klíč odpovídá privátnímu klíči (soubor může obsahovat i CA řetězec).
  const certs = certBags.map((b) => b.cert).filter((c): c is forge.pki.Certificate => !!c);
  const cert =
    certs.find((c) => {
      const pub = c.publicKey as forge.pki.rsa.PublicKey;
      return pub.n && key.n && pub.n.equals(key.n);
    }) ?? certs[0];
  if (!cert) throw new CertificateError("V souboru chybí certifikát.");

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
    },
    privateKeyPem: forge.pki.privateKeyToPem(key),
    certificatePem,
    certificateDerBase64: forge.util.encode64(der),
  };
}

export function daysUntilExpiry(info: CertificateInfo, now = new Date()): number {
  return Math.floor((info.validTo.getTime() - now.getTime()) / 86_400_000);
}

/** Vytvoří self-signed .p12 — jen pro testy a demo režim. */
export function createTestP12(opts: { commonName: string; password: string; days?: number }): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01" + forge.util.bytesToHex(forge.random.getBytesSync(8));
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + (opts.days ?? 365) * 86_400_000);
  const attrs = [{ name: "commonName", value: opts.commonName }, { name: "countryName", value: "CZ" }];
  cert.setSubject(attrs);
  cert.setIssuer([{ name: "commonName", value: "EvidujZdarma TEST CA" }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], opts.password, { algorithm: "3des" });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
}
