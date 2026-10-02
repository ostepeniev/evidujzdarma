/**
 * Testovací CA a podepsané odpovědi FS – jen pro testy ověření podpisu (R1.11).
 * Nikdy nejde o skutečné certifikáty I.CA / GFŘ.
 */
import { X509Certificate, generateKeyPairSync, randomUUID } from "node:crypto";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { EET_NS } from "../../src/eet2/message.ts";

function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  return { privatePem: privateKey, priv: forge.pki.privateKeyFromPem(privateKey), pub: forge.pki.publicKeyFromPem(publicKey) };
}

let serial = 1;
function issue(opts: {
  subject: forge.pki.CertificateField[];
  issuer: { subject: forge.pki.CertificateField[]; priv: forge.pki.rsa.PrivateKey } | null;
  ca: boolean;
  keyUsage?: Record<string, boolean>;
}) {
  const keys = keyPair();
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.pub;
  cert.serialNumber = (serial++).toString(16).padStart(2, "0");
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  cert.setSubject(opts.subject);
  cert.setIssuer(opts.issuer?.subject ?? opts.subject);
  cert.setExtensions([
    { name: "basicConstraints", cA: opts.ca, critical: true },
    { name: "keyUsage", critical: true, ...(opts.keyUsage ?? (opts.ca ? { keyCertSign: true, cRLSign: true } : { digitalSignature: true, nonRepudiation: true })) },
  ]);
  cert.sign(opts.issuer?.priv ?? keys.priv, forge.md.sha256.create());
  const pem = forge.pki.certificateToPem(cert);
  const derB64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
  return { subject: opts.subject, priv: keys.priv, privatePem: keys.privatePem, pem, derB64 };
}

/** Kořen + mezilehlá CA ve stylu I.CA. */
export function testCa() {
  const root = issue({ subject: [{ name: "commonName", value: "TEST I.CA Root CA" }, { name: "countryName", value: "CZ" }], issuer: null, ca: true });
  const intermediate = issue({ subject: [{ name: "commonName", value: "TEST I.CA Public CA" }, { name: "countryName", value: "CZ" }], issuer: root, ca: true });
  return { root, intermediate, chain: [new X509Certificate(intermediate.pem), new X509Certificate(root.pem)] };
}

export const GFR_SUBJECT: forge.pki.CertificateField[] = [
  { name: "commonName", value: "TEST - playground prostredi EET" },
  { name: "countryName", value: "CZ" },
  { name: "organizationName", value: "Generalni financni reditelstvi" },
  { type: "2.5.4.97", value: "NTRCZ-72080043" },
];

/** Koncový podpisový certifikát vydaný testovací mezilehlou CA. */
export function signerCert(ca: ReturnType<typeof testCa>, subject: forge.pki.CertificateField[] = GFR_SUBJECT, keyUsage?: Record<string, boolean>) {
  return issue({ subject, issuer: ca.intermediate, ca: false, keyUsage });
}

/** Odpověď FS s Potvrzeni, podepsaná daným certifikátem (WS-Security nad Body). */
export function signedResponse(
  signer: { privatePem: string; derB64: string },
  o: { uuid: string; pok: string; test: boolean; odpoved?: string; digestAlgorithm?: string; canonicalizationAlgorithm?: string; transforms?: string[] },
) {
  const bodyId = `Body-${randomUUID()}`;
  const xml =
    `<soapenv:Envelope xmlns:soapenv="${EET_NS.soapenv}" xmlns:eet="${EET_NS.v4}" xmlns:wsu="${EET_NS.wsu}" xmlns:wsse="${EET_NS.wsse}">` +
    `<soapenv:Header><wsse:Security soapenv:mustUnderstand="1">` +
    `<wsse:BinarySecurityToken EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" wsu:Id="SecurityToken-1">${signer.derB64}</wsse:BinarySecurityToken>` +
    `</wsse:Security></soapenv:Header>` +
    `<soapenv:Body wsu:Id="${bodyId}">${o.odpoved ?? `<eet:Odpoved><eet:Hlavicka uuid_zpravy="${o.uuid}" dat_prij="2026-10-02T12:00:00+02:00"/><eet:Potvrzeni pok="${o.pok}"${o.test ? ' test="true"' : ""}/></eet:Odpoved>`}</soapenv:Body>` +
    `</soapenv:Envelope>`;
  const sig = new SignedXml({
    privateKey: signer.privatePem,
    canonicalizationAlgorithm: o.canonicalizationAlgorithm ?? "http://www.w3.org/2001/10/xml-exc-c14n#",
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    idMode: "wssecurity",
  });
  sig.addReference({ xpath: "//*[local-name(.)='Body']", digestAlgorithm: o.digestAlgorithm ?? "http://www.w3.org/2001/04/xmlenc#sha256", transforms: o.transforms ?? ["http://www.w3.org/2001/10/xml-exc-c14n#"] });
  sig.computeSignature(xml, { location: { reference: "//*[local-name(.)='Security']", action: "append" } });
  return sig.getSignedXml();
}
