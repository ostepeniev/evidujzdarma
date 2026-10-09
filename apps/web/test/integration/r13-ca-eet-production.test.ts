/**
 * R13 (рецензія №11) – účet v ostrém provozu: řetězec CA EET (ověřený podpisem) × Policy OID → výsledek.
 *  R13.1:
 *   - prod / production → přijmout (ostrý);
 *   - playground / playground → přijmout jako před R12.2 – uloží se jako playground pro ověření, ostré tržby ho nepoužijí;
 *   - playground / production → CA_EET_TEST_ENV_MESSAGE;
 *   - zkus nebo test / jakýkoli → CA_EET_TEST_ENV_MESSAGE;
 *   - vydavatel mimo CA EET → jako před R12.2 (rozhoduje Policy OID).
 *  R13.2: jméno vydavatele CA EET, podpis nesedí → text doslovně.
 * Řetězce jsou syntetické (vytvořené v testu); caEetIssuer se volá se syntetickými kotvami místo oficiálních.
 */
import { getDb, schema } from "@ez/db";
import { createTestCa, createTestP12, type CaEetAnchors } from "@ez/fiscal-core/server";
import { and, eq, isNull } from "drizzle-orm";
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

const { importCertificate, CA_EET_TEST_ENV_MESSAGE, CA_EET_FORGED_MESSAGE } = await import("@/lib/server/certificates");
const { HttpError } = await import("@/lib/server/auth");
const { seedAccount } = await import("../helpers/fixtures");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const TEST_ENV = "Certifikát je z testovacího prostředí EET. Pro ostrý provoz si vygenerujte certifikát v produkčním DIS+.";
const FORGED =
  "Certifikát se nepodařilo ověřit: jeho podpis neodpovídá certifikační autoritě EET. Nahrajte soubor .p12 tak, jak jste ho stáhli z DIS+, nebo si v DIS+ vygenerujte nový certifikát.";
const OID = { production: "1.2.203.19122063.10.1.102.1.1", playground: "1.2.203.19122063.10.4.102.1.1" } as const;
type Oid = keyof typeof OID;

const p12 = (signer: { certPem: string; keyPem: string } | undefined, oid: Oid) => createTestP12({ commonName: "CZ12345679", password: "x", signer, policyOid: OID[oid] });
const upload = (accountId: string, signer: { certPem: string; keyPem: string } | undefined, oid: Oid) =>
  importCertificate(accountId, { file: p12(signer, oid), password: "x" }).then(
    (r) => `ok ${r.environment}`,
    (e: unknown) => (e instanceof HttpError ? `${e.status} ${e.message}` : `error ${String(e)}`),
  );
const active = (accountId: string) =>
  getDb()
    .select({ environment: schema.certificates.environment, issuer: schema.certificates.issuer })
    .from(schema.certificates)
    .where(and(eq(schema.certificates.accountId, accountId), isNull(schema.certificates.revokedAt)));

describe("R13.1 – production account: CA EET chain × Policy OID", () => {
  it("gate: prod / production → accepted as the production certificate", async () => {
    const s = await seedAccount({ mode: "production" });
    expect(await upload(s.account.id, ca.prod.sub, "production")).toBe("ok production");
    expect(await active(s.account.id)).toEqual([{ environment: "production", issuer: expect.stringContaining("SYNTH EETv2 NCA SubCA") }]);
  });

  it("gate: playground / playground → accepted again, stored as playground; the production certificate stays the one for sales", async () => {
    const s = await seedAccount({ mode: "production" });
    expect(await upload(s.account.id, ca.prod.sub, "production")).toBe("ok production");
    expect(await upload(s.account.id, ca.playground.sub, "playground")).toBe("ok playground");
    const rows = await active(s.account.id);
    expect(rows.map((r) => r.environment).sort()).toEqual(["playground", "production"]);
    expect(rows.find((r) => r.environment === "production")!.issuer).toContain("SYNTH EETv2 NCA SubCA");
    expect(rows.find((r) => r.environment === "playground")!.issuer).toContain("SYNTH playground SubCA");
  });

  it("gate: playground / production → CA_EET_TEST_ENV_MESSAGE, nothing stored", async () => {
    const s = await seedAccount({ mode: "production" });
    expect(await upload(s.account.id, ca.playground.sub, "production")).toBe(`400 ${TEST_ENV}`);
    expect(await active(s.account.id)).toEqual([]);
  });

  it("gate: zkus or test / any OID → CA_EET_TEST_ENV_MESSAGE, nothing stored", async () => {
    const s = await seedAccount({ mode: "production" });
    for (const env of ["zkus", "test"] as const) {
      for (const oid of ["production", "playground"] as const) {
        expect(await upload(s.account.id, ca[env].sub, oid), `${env} / ${oid}`).toBe(`400 ${TEST_ENV}`);
      }
    }
    expect(await active(s.account.id)).toEqual([]);
  });

  it("gate: issuer outside CA EET → as before R12.2 (the Policy OID decides)", async () => {
    const s = await seedAccount({ mode: "production" });
    expect(await upload(s.account.id, undefined, "production")).toBe("ok production");
    expect(await upload(s.account.id, undefined, "playground")).toBe("ok playground");
  });

  it("Playground and mock accounts – unchanged, every combination accepted by its OID", async () => {
    for (const mode of ["playground", "mock"] as const) {
      const s = await seedAccount({ mode });
      for (const env of ["prod", "zkus", "test", "playground"] as const) {
        for (const oid of ["production", "playground"] as const) {
          expect(await upload(s.account.id, ca[env].sub, oid), `${mode}: ${env} / ${oid}`).toBe(`ok ${oid}`);
        }
      }
      expect(await upload(s.account.id, forger.sub, "production"), `${mode}: forged`).toBe("ok production");
    }
  }, 60_000);
});

describe("R13.2 – CA EET issuer name, signature does not match", () => {
  it("gate: production account → the verbatim text, for either OID; nothing stored", async () => {
    expect(CA_EET_TEST_ENV_MESSAGE).toBe(TEST_ENV);
    expect(CA_EET_FORGED_MESSAGE).toBe(FORGED);
    const s = await seedAccount({ mode: "production" });
    expect(await upload(s.account.id, forger.sub, "production")).toBe(`400 ${FORGED}`);
    expect(await upload(s.account.id, forger.sub, "playground")).toBe(`400 ${FORGED}`);
    expect(await active(s.account.id)).toEqual([]);
  });
});
