/**
 * R4 – drobné body fiskálního jádra z rецензí (A r1 Дрібне 1–5, 17; A r2 Д-1, Д-5).
 */
import { readFileSync } from "node:fs";
import { createCipheriv, randomBytes } from "node:crypto";
import forge from "node-forge";
import { describe, expect, it } from "vitest";
import { Eet2Transport } from "../src/eet2/client.ts";
import { defaultTrustPolicy, verifyResponse } from "../src/eet2/response.ts";
import { decryptSecret, encryptSecret, LocalKeyEncryptor } from "../src/envelope.ts";
import { toHalere } from "../src/money.ts";
import { CertificateError, createTestP12, parseP12 } from "../src/p12.ts";
import { buildSale, type SaleInput } from "../src/sale.ts";
import { GFR_SUBJECT, signedResponse, signerCert, testCa } from "./helpers/signed-response.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";

describe("A Дрібне 1–2 / Д-5 – the signed Body wins over an unsigned Chyba", () => {
  const accepted = fixture("playground-accepted.xml");
  const uuid = "03965780-6457-4842-bd80-5f9195c0b8c8";
  const at = new Date("2026-07-21T10:06:00Z");
  const policy = defaultTrustPolicy("playground");
  const injected = `<eet:Odpoved><eet:Hlavicka uuid_zpravy="${uuid}"/><eet:Chyba kod="5" test="true">Podvrzena chyba</eet:Chyba></eet:Odpoved>`;

  it("gate: an unsigned Chyba injected into the Header next to the genuine signed Potvrzeni does not reject the sale", () => {
    const mitm = accepted.replace("<soapenv:Header>", `<soapenv:Header>${injected}`);
    expect(mitm).not.toBe(accepted);
    const v = verifyResponse(mitm, { expectedUuid: uuid, policy, now: at });
    expect(v.kind).toBe("confirmed");
    if (v.kind === "confirmed") expect(v.parsed.pok).toBe("91616ac4-83ae-4cca-89c8-986a62bc0c44-ff");
  });

  it("Odpoved is read only from Envelope/Body, never from a Body-like element elsewhere", () => {
    const fake = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:eet="http://fs.gov.cz/eet/schema/v4"><soapenv:Header><soapenv:Body>${injected}</soapenv:Body></soapenv:Header><soapenv:Body/></soapenv:Envelope>`;
    expect(verifyResponse(fake, { expectedUuid: uuid, policy, now: at }).kind).toBe("invalid");
    const noEnvelope = `<?xml version="1.0"?><soapenv:Body xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:eet="http://fs.gov.cz/eet/schema/v4">${injected}</soapenv:Body>`;
    expect(verifyResponse(noEnvelope, { expectedUuid: uuid, policy, now: at }).kind).toBe("invalid");
  });

  it("a plain unsigned error response (FS does not sign Chyba) is still an error", () => {
    const v = verifyResponse(fixture("unsigned-error.xml"), { expectedUuid: "123e4567-e89b-42d3-a456-426614174000", policy, now: at });
    expect(v).toMatchObject({ kind: "error", parsed: { error: { code: 3 } } });
  });

  describe("algorithms of the signature are pinned (DigestMethod, c14n, transforms)", () => {
    const ca = testCa();
    const testPolicy = { environment: "playground" as const, chain: ca.chain };
    const signer = signerCert(ca, GFR_SUBJECT);
    const u = "6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d";
    const pok = "11111111-2222-4333-8444-555555555555-ff";

    it("positive control: sha256 + exc-c14n is accepted", () => {
      expect(verifyResponse(signedResponse(signer, { uuid: u, pok, test: true }), { expectedUuid: u, policy: testPolicy }).kind).toBe("confirmed");
    });

    it("a SHA-1 digest is refused", () => {
      const xml = signedResponse(signer, { uuid: u, pok, test: true, digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1" });
      expect(verifyResponse(xml, { expectedUuid: u, policy: testPolicy })).toMatchObject({ kind: "invalid", reason: expect.stringMatching(/algoritm/) });
    });

    it("inclusive c14n of SignedInfo or of the reference is refused", () => {
      const c14n = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
      expect(verifyResponse(signedResponse(signer, { uuid: u, pok, test: true, canonicalizationAlgorithm: c14n }), { expectedUuid: u, policy: testPolicy }).kind).toBe("invalid");
      expect(verifyResponse(signedResponse(signer, { uuid: u, pok, test: true, transforms: [c14n] }), { expectedUuid: u, policy: testPolicy }).kind).toBe("invalid");
    });

    it("a Chyba inside a validly signed Body is an error read from the signed content", () => {
      const odpoved = `<eet:Odpoved><eet:Hlavicka uuid_zpravy="${u}" dat_odmit="2026-10-02T12:00:00+02:00"/><eet:Chyba kod="4" test="true">Neplatny podpis</eet:Chyba></eet:Odpoved>`;
      const v = verifyResponse(signedResponse(signer, { uuid: u, pok, test: true, odpoved }), { expectedUuid: u, policy: testPolicy });
      expect(v).toMatchObject({ kind: "error", parsed: { error: { code: 4 } } });
    });
  });
});

describe("Д-1 – reading the response body fails after the POST", () => {
  const cred = parseP12(createTestP12({ commonName: "CZ00000019", password: "x" }), "x");
  const sale = buildSale({
    id: "3f2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f",
    deviceId: "dev1",
    registerId: "P1",
    unitId: "303",
    sequence: "P1-000001",
    soldAt: "2027-01-15T10:30:00.123Z",
    lines: [{ name: "Střih", qty: 1, unitPrice: 50000, vatRate: 21 }],
    payments: [{ method: "card", amount: 50000 }],
    vatPayer: false,
    mode: "test",
  });

  it("gate: a body that throws (timeout / reset) → NETWORK with the message uuid, not an exception", async () => {
    const broken = { status: 200, text: async () => Promise.reject(new Error("socket hang up")) } as unknown as Response;
    const t = new Eet2Transport({ environment: "playground", credential: async () => cred, fetch: (async () => broken) as typeof fetch });
    const messageUuid = "8b0e4e32-1a8f-4a3e-9d55-2f1c3b4a5d6e";
    const r = await t.send(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ00000019", messageUuid });
    expect(r).toMatchObject({ ok: false, retryable: true, code: "NETWORK", messageUuid, audit: { httpStatus: 200, requestSha256: expect.stringMatching(/^[0-9a-f]{64}$/) } });
  });
});

describe("Д-2 – the audit hook runs before the POST", () => {
  const cred = parseP12(createTestP12({ commonName: "CZ00000019", password: "x" }), "x");
  const sale = buildSale({
    id: "4f2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f",
    deviceId: "dev1",
    registerId: "P1",
    unitId: "303",
    sequence: "P1-000003",
    soldAt: "2027-01-15T10:30:00.123Z",
    lines: [{ name: "Střih", qty: 1, unitPrice: 50000, vatRate: 21 }],
    payments: [{ method: "card", amount: 50000 }],
    vatPayer: false,
    mode: "test",
  });

  it("onPrepared gets the uuid and the request hash before fetch; a failing hook means no POST", async () => {
    const order: string[] = [];
    const t = new Eet2Transport({
      environment: "playground",
      credential: async () => cred,
      fetch: (async () => (order.push("fetch"), new Response("x", { status: 503 }))) as typeof fetch,
    });
    const r = await t.send(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ00000019", onPrepared: (p) => void order.push(`audit:${p.messageUuid}:${p.sha256.length}`) });
    expect(order).toEqual([`audit:${r.messageUuid}:64`, "fetch"]);

    order.length = 0;
    await expect(
      t.send(sale, {
        firstAttempt: true,
        verifyOnly: false,
        eic: "CZ00000019",
        onPrepared: () => {
          throw new Error("DB down");
        },
      }),
    ).rejects.toThrow("DB down");
    expect(order).toEqual([]);
  });
});

describe("A Дрібне 3 – AES-GCM tag length is enforced", () => {
  const key = randomBytes(32).toString("base64");
  const enc = new LocalKeyEncryptor({ v1: key }, "v1");

  it("gate: a ciphertext with a truncated tag is refused", async () => {
    const sealed = await encryptSecret(enc, Buffer.alloc(0), "account-1");
    // stejný DEK, prázdná data, jen 4 bajty tagu (Node bez authTagLength zkrácený tag přijme)
    const dek = await enc.unwrap(sealed.encryptedDek, "v1");
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", dek, iv);
    c.setAAD(Buffer.from("account-1"));
    c.final();
    const short = Buffer.concat([iv, c.getAuthTag().subarray(0, 4)]);
    await expect(decryptSecret(enc, { ...sealed, ciphertext: short }, "account-1")).rejects.toThrow();
  });

  it("round trip still works", async () => {
    const sealed = await encryptSecret(enc, Buffer.from("tajné"), "account-1");
    expect((await decryptSecret(enc, sealed, "account-1")).toString()).toBe("tajné");
  });
});

describe("A Дрібне 4 – .p12 whose certificate does not match the key", () => {
  it("gate: is refused instead of storing a mismatching key/certificate pair", () => {
    const a = forge.pki.rsa.generateKeyPair(1024);
    const b = forge.pki.rsa.generateKeyPair(1024);
    const cert = forge.pki.createCertificate();
    cert.publicKey = b.publicKey;
    cert.serialNumber = "01";
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 86_400_000);
    cert.setSubject([{ name: "commonName", value: "CZ00000019" }]);
    cert.setIssuer([{ name: "commonName", value: "TEST CA" }]);
    cert.sign(b.privateKey, forge.md.sha256.create());
    const p12 = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(a.privateKey, [cert], "x", { algorithm: "3des" })).getBytes(), "binary");
    expect(() => parseP12(p12, "x")).toThrow(CertificateError);
    expect(() => parseP12(p12, "x")).toThrow(/neodpovídá/);
  });
});

describe("A Дрібне 5 – toHalere parses decimals, not floats", () => {
  it("gate: 1.005 Kč rounds half up to 101 h", () => {
    expect(toHalere("1.005")).toBe(101);
    expect(toHalere(1.005)).toBe(101);
  });

  it("keeps the ordinary cases", () => {
    expect(toHalere("123,45")).toBe(12345);
    expect(toHalere("1 234.5")).toBe(123450);
    expect(toHalere(-0.05)).toBe(-5);
    expect(toHalere("-1.005")).toBe(-101);
    expect(toHalere(0.1 + 0.2)).toBe(30);
    expect(toHalere("19.99")).toBe(1999);
    expect(() => toHalere("abc")).toThrow(RangeError);
    expect(() => toHalere("1.2.3")).toThrow(RangeError);
    expect(() => toHalere(Number.NaN)).toThrow(RangeError);
  });
});

describe("A Дрібне 17 – no tip on a refund", () => {
  const refund: SaleInput = {
    id: "9a2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f",
    deviceId: "dev1",
    registerId: "P1",
    unitId: "303",
    sequence: "P1-000002",
    soldAt: "2027-01-15T10:30:00.123Z",
    lines: [{ name: "Střih", qty: -1, unitPrice: 50000, vatRate: 21 }],
    payments: [{ method: "cash", amount: -49000 }],
    tip: 1000,
    refundOf: "3f2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f",
    vatPayer: false,
    mode: "test",
  };

  it("gate: a refund with a positive tip is refused", () => {
    expect(() => buildSale(refund)).toThrow(/spropitné/);
  });

  it("a refund without a tip is fine", () => {
    expect(buildSale({ ...refund, tip: 0, payments: [{ method: "cash", amount: -50000 }] }).total).toBe(-50000);
  });
});
