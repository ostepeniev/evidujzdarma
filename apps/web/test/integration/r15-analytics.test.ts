/**
 * R15.1 (docs/tasks/2026-10-09-r15.md) – měření návštěvnosti bez cookies a bez ukládání IP.
 *  - beacon POST /api/m: odpověď bez Set-Cookie, počítají se jen marketingové stránky;
 *  - unikátní návštěvník za den = sha256(denní sůl + IP + User-Agent) jen v paměti; do DB jdou jen čísla po dnech;
 *  - boti, DNT: 1 a Sec-GPC: 1 se nepočítají vůbec (ani události trychtýře);
 *  - čas na stránce 0–1800 s (součet a počet), události trychtýře, retence 25 měsíců.
 */
import { getDb, schema } from "@ez/db";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
let pageHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => pageHeaders, cookies: async () => ({ get: () => undefined }) }));

const { POST: beacon } = await import("@/app/api/m/route");
const analytics = await import("@/lib/server/analytics");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  analytics.__resetAnalyticsForTests();
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.ARES_MOCK;
});

const IP = "203.0.113.77";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const hdrs = (extra: Record<string, string> = {}) => ({ "user-agent": UA, "x-real-ip": IP, ...extra });
const send = (body: unknown, extra: Record<string, string> = {}) =>
  beacon(new Request("http://localhost/api/m", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost", ...hdrs(extra) }, body: JSON.stringify(body) }));
const rows = () => getDb().select().from(schema.analyticsDaily);
const row = async (metric: string, key: string) => (await rows()).find((r) => r.metric === metric && r.key === key);

describe("R15.1 – collection without cookies and without IP", () => {
  it("gate: a page view – 204 without Set-Cookie; views, unique visitors (same IP+UA once), device and referrer domain per day", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-20T10:00:00Z"), toFake: ["Date"] });
    const r1 = await send({ t: "v", p: "/cenik", r: "www.google.com" });
    expect(r1.status).toBe(204);
    expect(r1.headers.get("set-cookie")).toBeNull();
    await send({ t: "v", p: "/cenik" });
    await send({ t: "v", p: "/" }, { "user-agent": UA_DESKTOP });
    expect(await row("page", "/cenik")).toMatchObject({ day: "2026-10-20", views: 2, visitors: 1 });
    expect(await row("page", "/")).toMatchObject({ views: 1, visitors: 1 });
    expect(await row("site", "")).toMatchObject({ views: 3, visitors: 2 });
    expect(await row("device", "mobile")).toMatchObject({ views: 2 });
    expect(await row("device", "desktop")).toMatchObject({ views: 1 });
    expect(await row("ref", "google.com")).toMatchObject({ views: 1 });
  });

  it("gate: neither the IP, the User-Agent nor a hash gets into the database (schema and rows after a view)", async () => {
    await send({ t: "v", p: "/kontrola-ico", r: "https://www.seznam.cz/hledani?q=eet+zdarma" });
    await send({ t: "t", p: "/kontrola-ico", s: 42, n: 1 });
    const cols = (await getDb().execute(sql`select column_name from information_schema.columns where table_name = 'analytics_daily' order by column_name`)) as unknown as { rows: { column_name: string }[] };
    expect(cols.rows.map((c) => c.column_name)).toEqual(["day", "key", "metric", "seconds_count", "seconds_sum", "views", "visitors"]);
    const dump = JSON.stringify(await rows());
    expect(dump).not.toContain(IP);
    expect(dump).not.toContain("iPhone");
    expect(dump).not.toMatch(/[0-9a-f]{32,}/);
    expect(dump).not.toContain("hledani");
    expect(await row("ref", "seznam.cz")).toMatchObject({ views: 1 });
  });

  it("gate: bots, DNT: 1, Sec-GPC: 1 and a missing User-Agent are not counted at all", async () => {
    for (const extra of <Record<string, string>[]>[
      { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      { "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2" },
      { "user-agent": "Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)" },
      { "user-agent": "ClaudeBot/1.0" },
      { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" },
      { "user-agent": "curl/8.5.0" },
      { "user-agent": "python-requests/2.32" },
      { "user-agent": "" },
      { dnt: "1" },
      { "sec-gpc": "1" },
    ]) {
      expect((await send({ t: "v", p: "/" }, extra)).status).toBe(204);
      await send({ t: "e", e: "quiz_done" }, extra);
    }
    expect(await rows()).toEqual([]);
  });

  it("gate: only marketing pages; query, other origins and junk are ignored", async () => {
    for (const p of ["/api/m", "/pokladna", "/pokladna/nastaveni", "/kabinet", "/admin", "/admin/predregistrace", "/prihlaseni", "/u/abc", "/cenik?x=1", "cenik", "/" + "a".repeat(300)]) await send({ t: "v", p });
    // jiný původ (cizí stránka) a ne-JSON
    await beacon(new Request("http://localhost/api/m", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", ...hdrs() }, body: JSON.stringify({ t: "v", p: "/" }) }));
    await beacon(new Request("http://localhost/api/m", { method: "POST", headers: { "content-type": "text/plain", ...hdrs() }, body: JSON.stringify({ t: "v", p: "/" }) }));
    await send({ t: "x", p: "/" });
    await send("nonsense");
    expect(await rows()).toEqual([]);
    // vlastní doména není zdroj
    await send({ t: "v", p: "/", r: "evidujzdarma.cz" });
    expect((await rows()).filter((r) => r.metric === "ref")).toEqual([]);
  });

  it("gate: time on the page – clamped to 0–1800 s, sum and count (count once per view)", async () => {
    await send({ t: "t", p: "/cenik", s: 30, n: 1 });
    await send({ t: "t", p: "/cenik", s: 12 });
    await send({ t: "t", p: "/cenik", s: 99_999, n: 1 });
    await send({ t: "t", p: "/cenik", s: -5, n: 1 });
    expect(await row("page", "/cenik")).toMatchObject({ views: 0, secondsSum: 30 + 12 + 1800 + 0, secondsCount: 3 });
  });

  it("gate: the salt and the hashes live for one Prague day – after midnight the same person is a new visitor of the new day", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-20T21:30:00Z"), toFake: ["Date"] }); // 23:30 v Praze
    await send({ t: "v", p: "/" });
    await send({ t: "v", p: "/" });
    vi.setSystemTime(new Date("2026-10-20T22:30:00Z")); // 0:30 v Praze, 21. 10.
    await send({ t: "v", p: "/" });
    const site = (await rows()).filter((r) => r.metric === "site").sort((a, b) => a.day.localeCompare(b.day));
    expect(site.map((r) => [r.day, r.views, r.visitors])).toEqual([
      ["2026-10-20", 2, 1],
      ["2026-10-21", 1, 1],
    ]);
    expect(analytics.__visitorStateForTests()).toEqual({ day: "2026-10-21", hashes: 2 }); // „site“ a „page:/“ nového dne
  });
});

describe("R15.1 – funnel events", () => {
  const event = async (name: string) => (await row("event", name))?.views ?? 0;

  it("gate: quiz_done and calculator_used from the page; unknown events are ignored", async () => {
    await send({ t: "e", e: "quiz_done" });
    await send({ t: "e", e: "calculator_used" });
    await send({ t: "e", e: "calculator_used" });
    await send({ t: "e", e: "prereg_confirmed" }); // serverová událost se z prohlížeče poslat nedá
    await send({ t: "e", e: "anything" });
    expect([await event("quiz_done"), await event("calculator_used"), await event("prereg_confirmed"), await event("anything")]).toEqual([1, 2, 0, 0]);
  });

  it("gate: prereg_submitted and prereg_confirmed are counted by the server handlers (not for DNT)", async () => {
    const { POST: preregister } = await import("@/app/api/preregistrace/route");
    const { POST: confirm } = await import("@/app/api/registrace/potvrdit/route");
    const submit = (email: string, extra: Record<string, string> = {}) =>
      preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", ...hdrs(extra) }, body: JSON.stringify({ email }) }));
    await submit("funnel-a@example.cz");
    await submit("funnel-a@example.cz"); // znovu tatáž adresa – nová předregistrace nevznikla
    await submit("funnel-b@example.cz", { dnt: "1" });
    expect(await event("prereg_submitted")).toBe(1);
    // platný je odkaz z připomenutí (druhé vyplnění vydalo nový token)
    const mails = await getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, "funnel-a@example.cz"), eq(schema.emailOutbox.template, "prereg-confirm")));
    const m = mails.find((x) => x.dedupeKey?.startsWith("prereg-confirm-resend:"));
    const form = new FormData();
    form.set("token", (m!.payload as { confirmToken: string }).confirmToken);
    await confirm(new Request("http://localhost/api/registrace/potvrdit", { method: "POST", headers: hdrs(), body: form }));
    await confirm(new Request("http://localhost/api/registrace/potvrdit", { method: "POST", headers: hdrs(), body: form }));
    expect(await event("prereg_confirmed")).toBe(1);
  });

  it("gate: ico_check – an IČO check with a result on /kontrola-ico (not for bots)", async () => {
    process.env.ARES_MOCK = "1";
    const { default: Page } = await import("@/app/(site)/kontrola-ico/page");
    pageHeaders = new Headers(hdrs());
    await Page({ searchParams: Promise.resolve({ ico: "12345679" }) } as never);
    await Page({ searchParams: Promise.resolve({ ico: "27082440" }) } as never); // v ARES není – bez výsledku
    await Page({ searchParams: Promise.resolve({ ico: "12345678" }) } as never); // neplatné
    pageHeaders = new Headers(hdrs({ "user-agent": "Googlebot/2.1" }));
    await Page({ searchParams: Promise.resolve({ ico: "12345679" }) } as never);
    expect(await event("ico_check")).toBe(1);
  });
});

describe("R15.1 – retention", () => {
  it("gate: aggregates are kept 25 months, then runRetention deletes them", async () => {
    const db = getDb();
    await db.insert(schema.analyticsDaily).values([
      { day: "2024-09-19", metric: "site", key: "", views: 5, visitors: 3 },
      { day: "2024-09-21", metric: "site", key: "", views: 7, visitors: 4 },
    ]);
    const { runRetention } = await import("@/lib/server/lifecycle");
    const out = await runRetention(new Date("2026-10-20T10:00:00Z"));
    expect(out.analytics).toBe(1);
    expect((await rows()).map((r) => r.day)).toEqual(["2024-09-21"]);
  });
});
