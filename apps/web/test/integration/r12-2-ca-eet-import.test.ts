/**
 * R12.2 (рецензія №9, доповнення №10) – při nahrání .p12 se ověří řetězec CA EET (podpis list → SubCA → Root).
 *  - účet v ostrém provozu přijme řetězec `prod`; zkušební, testovací a Playground s OID ostrého certifikátu → chyba
 *    doslovně (celá tabulka řetězec × Policy OID a Playground pro ověření – r13-ca-eet-production.test.ts);
 *  - vydavatel, který v CA EET není → beze změny;
 *  - účet v režimu Playground / ukázkovém → jako dosud, žádné nové odmítnutí.
 * Řetězce jsou syntetické (vytvořené v testu); caEetIssuer se volá se syntetickými kotvami místo oficiálních.
 */
import { createTestCa, createTestP12, type CaEetAnchors } from "@ez/fiscal-core/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

const ca = {
  prod: createTestCa({ rootName: "SYNTH EETv2 NCA Root CA", subName: "SYNTH EETv2 NCA SubCA" }),
  zkus: createTestCa({ rootName: "SYNTH neprodukcni Root CA", subName: "SYNTH neprodukcni SubCA" }),
  test: createTestCa({ rootName: "SYNTH test Root CA", subName: "SYNTH test SubCA" }),
  playground: createTestCa({ rootName: "SYNTH playground RootCA", subName: "SYNTH playground SubCA" }),
};
const forger = createTestCa({ rootName: "SYNTH forger Root", subName: "SYNTH EETv2 NCA SubCA" });
const ANCHORS: CaEetAnchors = Object.fromEntries(Object.entries(ca).map(([env, c]) => [env, { root: c.root.certPem, sub: c.sub.certPem }]));

vi.mock("@ez/fiscal-core/server", async (orig) => {
  const real = await orig<typeof import("@ez/fiscal-core/server")>();
  return { ...real, caEetIssuer: (pem: string) => real.caEetIssuer(pem, ANCHORS) };
});

const { importCertificate } = await import("@/lib/server/certificates");
const { HttpError } = await import("@/lib/server/auth");
const { seedAccount } = await import("../helpers/fixtures");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const TEST_ENV_MESSAGE = "Certifikát je z testovacího prostředí EET. Pro ostrý provoz si vygenerujte certifikát v produkčním DIS+.";
const PROD_OID = "1.2.203.19122063.10.1.102.1.1";
const PG_OID = "1.2.203.19122063.10.4.102.1.1";
const p12 = (signer?: { certPem: string; keyPem: string }, policyOid: string = PROD_OID) =>
  createTestP12({ commonName: "CZ12345679", password: "x", signer, policyOid });
const outcome = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof HttpError ? `${e.status} ${e.message}` : `error ${String(e)}`),
  );

describe("R12.2 – CA EET chain on .p12 upload", () => {
  it("gate: a production account accepts the prod chain", async () => {
    const s = await seedAccount({ mode: "production" });
    const r = await importCertificate(s.account.id, { file: p12(ca.prod.sub), password: "x" });
    expect(r.environment).toBe("production");
  });

  it("gate: a production account refuses zkušební, testovací and Playground chains with a production OID (verbatim message)", async () => {
    const s = await seedAccount({ mode: "production" });
    for (const env of ["zkus", "test", "playground"] as const) {
      // i s OID ostrého certifikátu: rozhoduje ověřený řetězec (Playground s OID Playground se přijme – R13.1)
      expect(await outcome(importCertificate(s.account.id, { file: p12(ca[env].sub), password: "x" })), env).toBe(`400 ${TEST_ENV_MESSAGE}`);
    }
  });

  it("gate: an issuer outside CA EET → behaviour unchanged (accepted by the policy OID)", async () => {
    const s = await seedAccount({ mode: "production" });
    const r = await importCertificate(s.account.id, { file: p12(), password: "x" });
    expect(r.environment).toBe("production");
  });

  it("gate: Playground and mock accounts – no new refusals", async () => {
    for (const mode of ["playground", "mock"] as const) {
      const s = await seedAccount({ mode });
      expect(await outcome(importCertificate(s.account.id, { file: p12(ca.test.sub), password: "x" })), mode).toBe("ok");
      expect(await outcome(importCertificate(s.account.id, { file: p12(ca.playground.sub, PG_OID), password: "x" })), mode).toBe("ok");
      expect(await outcome(importCertificate(s.account.id, { file: p12(forger.sub), password: "x" })), mode).toBe("ok");
    }
  });

  it("a production account refuses a certificate whose issuer name matches CA EET but whose signature does not", async () => {
    const s = await seedAccount({ mode: "production" });
    const r = await outcome(importCertificate(s.account.id, { file: p12(forger.sub), password: "x" }));
    expect(r).toMatch(/^400 /);
    expect(r).not.toContain(TEST_ENV_MESSAGE);
  });
});
