import { readFileSync } from "node:fs";
import { createHash, createVerify, X509Certificate } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import {
  buildEetMessage,
  canonicalBody,
  canonicalSignedInfo,
  formatEetDateTime,
  isPok,
  validateEetMessage,
  EetMessageError,
  type EetMessage,
} from "../src/eet2/message.ts";
import { prepareRequest, Eet2Transport } from "../src/eet2/client.ts";
import { defaultTrustPolicy, verifyResponse } from "../src/eet2/response.ts";
import { GFR_SUBJECT, signedResponse, signerCert, testCa } from "./helpers/signed-response.ts";
import { buildSale, evidencedAmounts, type SaleInput } from "../src/sale.ts";
import { createTestP12, parseP12 } from "../src/p12.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("conformance with the official signed FS sample (CZ00000019)", () => {
  const xml = fixture("official-request-CZ00000019.xml");
  const bodyId = "id-73E2DBECC9F62C5AB8177998819768224";
  const message: EetMessage = {
    header: { uuid_zpravy: "03965780-6457-4842-bd80-5f9195c0b8c8", dat_odesl: "2026-07-01T09:02:18Z", prvni_zaslani: true, overeni: false },
    data: {
      eic_popl: "CZ00000019",
      id_jednotky: 303,
      id_pokl: "/5604/MA65",
      porad_cis: "00/2224/SO57",
      dat_trzby: "2026-07-01T09:02:18Z",
      celk_trzba: "188580.00",
      urceno_cerp_zuct: "25.00",
      cerp_zuct: "302.00",
    },
  };

  it("canonical Body digest matches the official DigestValue", () => {
    const digest = createHash("sha256").update(canonicalBody(message, bodyId)).digest("base64");
    expect(digest).toBe(xml.match(/<ds:DigestValue>([^<]+)</)![1]);
  });

  it("canonical SignedInfo verifies against the official RSA signature", () => {
    const digest = createHash("sha256").update(canonicalBody(message, bodyId)).digest("base64");
    const cert = new X509Certificate(Buffer.from(xml.match(/<wsse:BinarySecurityToken[^>]*>([^<]+)</)![1]!, "base64"));
    const v = createVerify("RSA-SHA256");
    v.update(canonicalSignedInfo(bodyId, digest));
    expect(v.verify(cert.publicKey, Buffer.from(xml.match(/<ds:SignatureValue>([^<]+)</)![1]!, "base64"))).toBe(true);
  });

  it("official sample passes our XSD-derived validation", () => {
    expect(validateEetMessage(message)).toEqual([]);
  });
});

const saleInput: SaleInput = {
  id: "3f2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f",
  deviceId: "dev1",
  registerId: "P1",
  unitId: "303",
  sequence: "P1-000001",
  soldAt: "2027-01-15T10:30:00.123Z",
  lines: [
    { name: "Střih", qty: 1, unitPrice: 50000, vatRate: 21 },
    { name: "Dárkový poukaz", qty: 1, unitPrice: 100000, vatRate: 0, kind: "prepayment" },
  ],
  payments: [
    { method: "card", amount: 120000 },
    { method: "voucher", amount: 30000 },
  ],
  vatPayer: false,
  mode: "test",
};

describe("message building", () => {
  it("maps sale to EET fields", () => {
    const sale = buildSale(saleInput);
    expect(evidencedAmounts(sale)).toEqual({ total: 150000, prepayment: 100000, redeemed: 30000 });
    const m = buildEetMessage(sale, {
      eic: "CZ00000019",
      messageUuid: "6a1f2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      sentAt: new Date("2027-01-15T10:30:05.900Z"),
      firstAttempt: true,
      verifyOnly: false,
    });
    expect(m.data).toEqual({
      eic_popl: "CZ00000019",
      id_jednotky: 303,
      id_pokl: "P1",
      porad_cis: "P1-000001",
      dat_trzby: "2027-01-15T10:30:00Z",
      celk_trzba: "1500.00",
      urceno_cerp_zuct: "1000.00",
      cerp_zuct: "300.00",
    });
    expect(m.header.dat_odesl).toBe("2027-01-15T10:30:05Z");
  });

  it("excludes remote bank transfer from evidenced total", () => {
    const sale = buildSale({ ...saleInput, lines: [saleInput.lines[0]!], payments: [{ method: "transfer", amount: 50000 }] });
    expect(evidencedAmounts(sale).total).toBe(0);
  });

  it("rejects invalid identity", () => {
    const sale = buildSale(saleInput);
    expect(() =>
      buildEetMessage({ ...sale, unitId: "0" }, { eic: "CZ1", messageUuid: "x", sentAt: new Date(), firstAttempt: true, verifyOnly: false }),
    ).toThrow(EetMessageError);
  });

  it("formats dates without milliseconds and validates POK", () => {
    expect(formatEetDateTime("2027-01-01T00:00:00.999Z")).toBe("2027-01-01T00:00:00Z");
    expect(isPok("91616ac4-83ae-4cca-89c8-986a62bc0c44-ff")).toBe(true);
    expect(isPok("91616ac4-83ae-1cca-89c8-986a62bc0c44-ff")).toBe(false);
  });
});

describe("request signing", () => {
  const cred = parseP12(createTestP12({ commonName: "CZ00000019", password: "x" }), "x");

  it("produces an envelope that an independent XMLDSig implementation verifies", () => {
    const sale = buildSale(saleInput);
    const prepared = prepareRequest(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ00000019" }, cred, new Date("2027-01-15T10:30:01Z"));
    const doc = new DOMParser().parseFromString(prepared.xml, "text/xml");
    const sigNode = doc.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature")[0]!;
    const sx = new SignedXml({ publicCert: cred.certificatePem, idMode: "wssecurity", getCertFromKeyInfo: () => null });
    sx.loadSignature(sigNode as unknown as Node);
    expect(sx.checkSignature(prepared.xml)).toBe(true);
    expect(prepared.xml).toContain('celk_trzba="1500.00"');
    expect(prepared.xml).toContain('prvni_zaslani="true"');
  });

  it("tampering with the body breaks the signature", () => {
    const sale = buildSale(saleInput);
    const prepared = prepareRequest(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ00000019" }, cred);
    const tampered = prepared.xml.replace('celk_trzba="1500.00"', 'celk_trzba="15.00"');
    const doc = new DOMParser().parseFromString(tampered, "text/xml");
    const sx = new SignedXml({ publicCert: cred.certificatePem, idMode: "wssecurity", getCertFromKeyInfo: () => null });
    sx.loadSignature(doc.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature")[0]! as unknown as Node);
    let valid: boolean;
    try {
      valid = sx.checkSignature(tampered);
    } catch {
      valid = false;
    }
    expect(valid).toBe(false);
  });
});

describe("response verification", () => {
  const accepted = fixture("playground-accepted.xml");
  const policy = defaultTrustPolicy("playground");
  const uuid = "03965780-6457-4842-bd80-5f9195c0b8c8";
  const at = new Date("2026-07-21T10:06:00Z");

  it("accepts the real signed Playground response", () => {
    const v = verifyResponse(accepted, { expectedUuid: uuid, policy, now: at });
    expect(v.kind).toBe("confirmed");
    if (v.kind === "confirmed") {
      expect(v.parsed.pok).toBe("91616ac4-83ae-4cca-89c8-986a62bc0c44-ff");
      expect(v.parsed.test).toBe(true);
    }
  });

  it("rejects a tampered POK", () => {
    const t = accepted.replace("91616ac4-83ae-4cca-89c8-986a62bc0c44-ff", "91616ac4-83ae-4cca-89c8-986a62bc0c45-ff");
    expect(verifyResponse(t, { expectedUuid: uuid, policy, now: at }).kind).toBe("invalid");
  });

  it("rejects a mismatched UUID", () => {
    expect(verifyResponse(accepted, { expectedUuid: "123e4567-e89b-42d3-a456-426614174000", policy, now: at }).kind).toBe("invalid");
  });

  it("rejects the response under the production trust policy", () => {
    expect(verifyResponse(accepted, { expectedUuid: uuid, policy: defaultTrustPolicy("production"), now: at }).kind).toBe("invalid");
  });

  it("treats unsigned errors as errors, never as confirmation", () => {
    const v = verifyResponse(fixture("unsigned-error.xml"), { expectedUuid: "123e4567-e89b-42d3-a456-426614174000", policy, now: at });
    expect(v.kind).toBe("error");
    if (v.kind === "error") expect(v.parsed.error).toEqual({ code: 3, text: "Datova zprava nevyhovuje XML schematu." });
  });

  it("rejects DTDs", () => {
    expect(verifyResponse(`<!DOCTYPE x [<!ENTITY a "b">]>${accepted}`, { expectedUuid: uuid, policy, now: at }).kind).toBe("invalid");
  });
});

describe("response signer pin (R1.11)", () => {
  const ca = testCa();
  const policy = { environment: "playground" as const, chain: ca.chain };
  const uuid = "6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d";
  const pok = "11111111-2222-4333-8444-555555555555-ff";

  it("accepts a response signed by the GFŘ signer (positive control of the test CA)", () => {
    const v = verifyResponse(signedResponse(signerCert(ca), { uuid, pok, test: true }), { expectedUuid: uuid, policy });
    expect(v.kind).toBe("confirmed");
  });

  it("gate: a response signed by another certificate from the same CA is invalid", () => {
    const other = signerCert(ca, [
      { name: "commonName", value: "Kdokoli s certifikátem od I.CA" },
      { name: "countryName", value: "CZ" },
      { name: "organizationName", value: "Jiná firma s.r.o." },
      { type: "2.5.4.97", value: "NTRCZ-12345678" },
    ]);
    const v = verifyResponse(signedResponse(other, { uuid, pok, test: true }), { expectedUuid: uuid, policy });
    expect(v).toMatchObject({ kind: "invalid" });
  });

  it("rejects a GFŘ certificate without digitalSignature + nonRepudiation", () => {
    const encOnly = signerCert(ca, GFR_SUBJECT, { keyEncipherment: true, digitalSignature: true });
    expect(verifyResponse(signedResponse(encOnly, { uuid, pok, test: true }), { expectedUuid: uuid, policy }).kind).toBe("invalid");
  });
});

describe("Eet2Transport", () => {
  const cred = parseP12(createTestP12({ commonName: "CZ00000019", password: "x" }), "x");
  const sale = buildSale(saleInput);

  it("returns POK from a verified response", async () => {
    const t = new Eet2Transport({
      environment: "playground",
      credential: async () => cred,
      fetch: (async () => new Response(fixture("playground-accepted.xml"), { status: 200 })) as typeof fetch,
    });
    const r = await t.send(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ00000019", messageUuid: "03965780-6457-4842-bd80-5f9195c0b8c8" });
    expect(r).toMatchObject({ ok: true, confirmationCode: "91616ac4-83ae-4cca-89c8-986a62bc0c44-ff", test: true });
  });

  it("marks network failures retryable", async () => {
    const t = new Eet2Transport({
      environment: "playground",
      credential: async () => cred,
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    });
    const r = await t.send(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ00000019" });
    expect(r).toMatchObject({ ok: false, retryable: true, code: "NETWORK" });
  });

  it("treats HTTP errors without an EET answer as retryable", async () => {
    const t = new Eet2Transport({
      environment: "playground",
      credential: async () => cred,
      fetch: (async () => new Response("Forbidden", { status: 403 })) as typeof fetch,
    });
    const r = await t.send(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ00000019" });
    expect(r).toMatchObject({ ok: false, retryable: true, code: "HTTP_403" });
  });

  it("maps positive error codes to non-retryable", async () => {
    const t = new Eet2Transport({
      environment: "playground",
      credential: async () => cred,
      fetch: (async () => new Response(fixture("unsigned-error.xml"), { status: 200 })) as typeof fetch,
    });
    const r = await t.send(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ00000019", messageUuid: "123e4567-e89b-42d3-a456-426614174000" });
    expect(r).toMatchObject({ ok: false, retryable: false, code: "EET_3" });
  });
});

describe("snapshot and blocked sends (R1.3, R1.5)", () => {
  const cred = parseP12(createTestP12({ commonName: "CZ00000019", password: "x" }), "x");
  const sale = buildSale(saleInput);

  it("a retry built from the stored snapshot keeps the original data even if the EIČ changed", async () => {
    const { eetSnapshot } = await import("../src/eet2/message.ts");
    const snapshot = eetSnapshot(sale, { eic: "CZ00000019" });
    const retry = prepareRequest(sale, { firstAttempt: false, verifyOnly: false, eic: "CZ99999999", snapshot }, cred);
    expect(retry.message.data).toEqual(snapshot);
    expect(retry.message.header.prvni_zaslani).toBe(false);
    expect(retry.xml).toContain('eic_popl="CZ00000019"');
  });

  it("a missing certificate blocks the sale instead of rejecting it", async () => {
    const t = new Eet2Transport({
      environment: "playground",
      credential: async () => {
        throw new Error("Chybí platný certifikát");
      },
      fetch: (async () => new Response("", { status: 500 })) as typeof fetch,
    });
    const r = await t.send(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ00000019" });
    expect(r).toMatchObject({ ok: false, retryable: true, blocked: "PREPARE" });
  });

  it("returns the raw signed response for the audit", async () => {
    const t = new Eet2Transport({
      environment: "playground",
      credential: async () => cred,
      fetch: (async () => new Response(fixture("playground-accepted.xml"), { status: 200 })) as typeof fetch,
    });
    const r = await t.send(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ00000019", messageUuid: "03965780-6457-4842-bd80-5f9195c0b8c8" });
    expect(r.audit?.responseBody).toContain("Odpoved");
    expect(r.audit?.requestSha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
