/**
 * R6.12 (рецензія №3, A Д-9) – import certifikátu, jehož CN není EIČ (^CZ\d{8,10}$), skončí 400 a nic se neuloží.
 */
import { createTestP12 } from "@ez/fiscal-core/server";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "@/lib/server/auth";
import { importCertificate } from "@/lib/server/certificates";
import { TEST_POLICY } from "../helpers/certs";
import { seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

describe("R6.12 – import refuses a certificate whose CN is not an EIČ", () => {
  it("gate: CN CZ12345678901 → 400, nothing stored", async () => {
    const s = await seedAccount({ eic: null });
    const file = createTestP12({ commonName: "CZ12345678901", password: "x", policyOid: TEST_POLICY.production });
    const err = (await importCertificate(s.account.id, { file, password: "x" }).catch((e: unknown) => e)) as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/nejde zjistit EIČ/);
    expect(await getDb().select().from(schema.certificates).where(eq(schema.certificates.accountId, s.account.id))).toHaveLength(0);
  });

  it("gate: EIČ only in serialNumber → 400", async () => {
    const s = await seedAccount({ eic: null });
    const file = createTestP12({ commonName: "Pokladna 1", password: "x", policyOid: TEST_POLICY.production, subjectSerialNumber: "CZ12345678" });
    const err = (await importCertificate(s.account.id, { file, password: "x" }).catch((e: unknown) => e)) as HttpError;
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/nejde zjistit EIČ/);
  });
});
