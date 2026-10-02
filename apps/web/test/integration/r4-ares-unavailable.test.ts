/**
 * R4 (k R3.3) – když ARES neodpovídá, stránka firmy mimo DB nespadne na 500, ale ukáže dočasnou
 * nedostupnost (noindex) s odkazem přímo do ARES. Chyba naší DB se za „ARES nedostupný“ neschová.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

// klient ARES si fetch bere při načtení modulu – podvrhnout ho je třeba před importem
const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);
delete process.env.ARES_MOCK;

let t: TestDb;
let loadFirmPage: typeof import("@/lib/server/firm-page").loadFirmPage;

beforeAll(async () => {
  t = await createTestDb();
  ({ loadFirmPage } = await import("@/lib/server/firm-page"));
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await t.close();
});

describe("R4 – firm page when ARES is down", () => {
  it("ARES network failure → 'unavailable' state, not an exception (no 500)", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(loadFirmPage("12345679-kadernictvi", "198.51.100.1")).resolves.toEqual({ kind: "unavailable", ico: "12345679" });
  });

  it("ARES 403/5xx → 'unavailable' too", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));
    await expect(loadFirmPage("11111119", "198.51.100.2")).resolves.toEqual({ kind: "unavailable", ico: "11111119" });
  });

  it("a subject that ARES does not know is still a 404", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(loadFirmPage("22222227", "198.51.100.3")).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("a database failure is not disguised as ARES being down", async () => {
    const db = await import("@ez/db");
    const spy = vi.spyOn(db, "getDb").mockImplementation(() => {
      throw new Error("connection refused");
    });
    try {
      await expect(loadFirmPage("25596641", "198.51.100.4")).rejects.toThrow(/connection refused/);
    } finally {
      spy.mockRestore();
    }
  });
});
