/**
 * R7.15 N9 (рецензія №4) – pokladna zrušeného účtu po 30. dni dostane od serveru text „Účet je zrušený a pokladna je
 * odpojená.“ i poté, co ji retention odpojí (revokedAt) – ne obecné „není registrované“.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, authenticateDevice } from "@/lib/server/auth";
import { closeAccount, runRetention } from "@/lib/server/lifecycle";
import { sha256 } from "@/lib/server/tokens";
import { deviceSale, seedAccount, storeVerifiedCertificate, deviceContext } from "../helpers/fixtures";
import { ingestSales } from "@/lib/server/sales";
import { testCert } from "../helpers/certs";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => vi.useRealTimers());

const DAY = 86_400_000;
const token = "z".repeat(40);
const req = () => new Request("http://localhost/api/pokladna/config", { headers: { authorization: `Bearer ${token}` } });

describe("R7.15 N9 – the register of a closed account learns why it is disconnected", () => {
  it("gate: after day 30 and after retention revoked the device → 401 'Účet je zrušený a pokladna je odpojená.'", async () => {
    const s = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    // neodeslaná ostrá tržba – účet se drží, retention zařízení jen odpojí
    await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "production" }) as never]);
    await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
    await closeAccount(s.account.id, { confirm: true });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 31 * DAY));
    await runRetention(new Date());
    expect((await getDb().query.devices.findFirst({ where: eq(schema.devices.id, s.device.id) }))!.revokedAt).not.toBeNull();
    const err = (await authenticateDevice(req(), { allowClosed: true }).catch((e: unknown) => e)) as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
    expect(err.message).toBe("Účet je zrušený a pokladna je odpojená.");
  });

  it("control: a device revoked by the owner on a live account keeps the generic text", async () => {
    const s = await seedAccount({ mode: "mock" });
    await getDb().update(schema.devices).set({ tokenHash: sha256(token), revokedAt: new Date() }).where(eq(schema.devices.id, s.device.id));
    const err = (await authenticateDevice(req()).catch((e: unknown) => e)) as HttpError;
    expect(err.status).toBe(401);
    expect(err.message).toBe("Zařízení není registrované nebo bylo odpojeno");
  });
});
