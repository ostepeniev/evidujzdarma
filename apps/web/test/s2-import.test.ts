/**
 * S2-E (17. 10. 2026): „Přejděte z jiné pokladny“ – stránka /prechod-z-jine-pokladny (férové srovnání cen s datem
 * a zdroji, kalkulačka, postup přechodu) a import zboží do katalogu ze souboru CSV/TSV.
 *  - parser (lib/pos/import-products.ts): kódování, oddělovač, desetinná čárka, uvozovky, chybějící cena, duplicity, presety;
 *  - API /api/ucet/katalog/import: zod limity, původ a velikost těla v proxy, přihlášení, strop katalogu, limit četnosti, vrácení;
 *  - stránka: ceny s datem ověření a zdroji, budoucí čas o pokladně do 2. 11. 2026, registrace v sitemap a llms.txt.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sha256 } from "@/lib/server/tokens";
import {
  IMPORT_LIMITS,
  ImportFileError,
  buildPreview,
  decodeImportFile,
  detectDelimiter,
  guessMapping,
  nameKey,
  parsePrice,
  parseVat,
  readImportFile,
} from "@/lib/pos/import-products";
import { seedAccount } from "./helpers/fixtures";
import { mockLaunch } from "./helpers/launch";
import { pageText } from "./helpers/render-text";
import { createTestDb, type TestDb } from "./helpers/test-db";

let sessionToken: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "ez_session" && sessionToken ? { value: sessionToken } : undefined) }),
  headers: async () => new Headers({ "x-real-ip": "198.51.100.90", "user-agent": "Mozilla/5.0" }),
}));

/** Text → bajty ve Windows-1250 (tabulka z dekodéru, ať test nepotřebuje knihovnu). */
const CP1250 = (() => {
  const dec = new TextDecoder("windows-1250");
  const map = new Map<string, number>();
  for (let b = 0; b < 256; b++) map.set(dec.decode(new Uint8Array([b])), b);
  return (s: string) => new Uint8Array([...s].map((ch) => map.get(ch) ?? 0x3f));
})();
const utf8 = (s: string) => new TextEncoder().encode(s);
const utf16le = (s: string) => {
  const out = new Uint8Array(2 + s.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < s.length; i++) {
    out[2 + i * 2] = s.charCodeAt(i) & 0xff;
    out[3 + i * 2] = s.charCodeAt(i) >> 8;
  }
  return out;
};
const preview = (bytes: Uint8Array, opts: Parameters<typeof buildPreview>[2] = { vatPayer: true }) => {
  const t = readImportFile(bytes);
  return { t, p: buildPreview(t, t.mapping, opts) };
};
const nb = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  return "";
};

describe("S2-E – parser: encodings, delimiters, numbers", () => {
  it("gate: semicolon CSV in Windows-1250 with decimal comma and Czech diacritics", () => {
    const csv = "Název;Cena s DPH;DPH;Kategorie\r\nKáva s mlékem;45,50;21;Nápoje\r\nŽluťoučký čaj;35;12 %;Nápoje\r\nChléb kváskový;1 234,90 Kč;12;Pečivo\r\n";
    const { t, p } = preview(CP1250(csv));
    expect(t.encoding).toBe("windows-1250");
    expect(t.delimiter).toBe(";");
    expect(t.preset).toBeNull();
    expect(t.mapping).toMatchObject({ name: 0, price: 1, vat: 2, category: 3 });
    expect(p.rows.map((r) => [r.line, r.name, r.price, r.vatRate, r.category, r.status])).toEqual([
      [2, "Káva s mlékem", 4550, 21, "Nápoje", "ok"],
      [3, "Žluťoučký čaj", 3500, 12, "Nápoje", "ok"],
      [4, "Chléb kváskový", 123490, 12, "Pečivo", "ok"],
    ]);
    // S3-POKLADNA: kategorie (a kód) jdou s položkou na server a ukládají se
    expect(p.items).toEqual([
      { name: "Káva s mlékem", price: 4550, vatRate: 21, category: "Nápoje" },
      { name: "Žluťoučký čaj", price: 3500, vatRate: 12, category: "Nápoje" },
      { name: "Chléb kváskový", price: 123490, vatRate: 12, category: "Pečivo" },
    ]);
    // stejný text v UTF-8 (s BOM i bez) dá totéž
    expect(decodeImportFile(utf8(csv)).encoding).toBe("utf-8");
    expect(buildPreview(readImportFile(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8(csv)])), t.mapping, { vatPayer: true }).items).toEqual(p.items);
  });

  it("gate: quoted fields – delimiter, \"\" and a line break inside quotes; line numbers stay right", () => {
    const csv = 'name,price,vat\n"Káva, velká",45.5,21\n"Dort ""Sacher""",89,12\n"Víceřádkový\nnázev",10,21\n\nČaj,35,21\n';
    const { t, p } = preview(utf8(csv));
    expect(t.delimiter).toBe(",");
    expect(p.rows.map((r) => [r.line, r.name, r.price])).toEqual([
      [2, "Káva, velká", 4550],
      [3, 'Dort "Sacher"', 8900],
      [4, "Víceřádkový název", 1000],
      [7, "Čaj", 3500],
    ]);
  });

  it("tab-separated text from Excel („Text v kódování Unicode“ = UTF-16LE) and the sep= line", () => {
    const { t, p } = preview(utf16le("Položka\tProdejní cena\tSazba DPH\r\nStřih pánský\t350\t21\r\n"));
    expect(t.encoding).toBe("utf-16le");
    expect(t.delimiter).toBe("\t");
    expect(p.items).toEqual([{ name: "Střih pánský", price: 35000, vatRate: 21 }]);
    const sep = readImportFile(utf8("sep=,\nnázev,cena\nA;B,10\n"));
    expect(sep.delimiter).toBe(",");
    expect(sep.rows[0]).toEqual({ line: 3, cells: ["A;B", "10"] });
    expect(detectDelimiter("a;b;c\n1;2,5;3\n4;5;6")).toBe(";");
  });

  it("gate: prices – thousands, decimal comma/dot, „,-“, ambiguous and invalid values", () => {
    expect(parsePrice("1.234,50")).toEqual({ ok: true, value: 123450 });
    expect(parsePrice("1,234.50")).toEqual({ ok: true, value: 123450 });
    expect(parsePrice("45,-")).toEqual({ ok: true, value: 4500 });
    expect(parsePrice("45.0000")).toEqual({ ok: true, value: 4500 });
    expect(parsePrice("0,5")).toEqual({ ok: true, value: 50 });
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("1.500")).toMatchObject({ ok: false });
    expect(parsePrice("abc")).toMatchObject({ ok: false });
    expect(parsePrice("-12,50")).toEqual({ ok: false, error: "Cena musí být větší než 0 Kč." });
    expect(parsePrice("0")).toEqual({ ok: false, error: "Cena musí být větší než 0 Kč." });
    expect(parsePrice("10000000,01")).toMatchObject({ ok: false });
    expect(parseVat("21 %")).toEqual({ ok: true, value: 21 });
    expect(parseVat("0,12")).toEqual({ ok: true, value: 12 });
    expect(parseVat("základní")).toEqual({ ok: true, value: 21 });
    expect(parseVat("15")).toEqual({ ok: false, error: "Sazba DPH musí být 0, 12 nebo 21 %." });
  });
});

describe("S2-E – parser: validation and duplicates", () => {
  it("gate: a row without a price is an error row (the others import); bad VAT, missing and too long names too", () => {
    const csv = `Název;Cena;DPH\nKáva;45;21\nČaj;;21\n;30;21\nDort;89;15\n${"x".repeat(81)};10;21\nVoda;-5;21\n`;
    const { p } = preview(utf8(csv));
    expect(p.rows.map((r) => [r.line, r.status, r.message ?? ""])).toEqual([
      [2, "ok", ""],
      [3, "error", "Chybí cena."],
      [4, "error", "Chybí název."],
      [5, "error", "Sazba DPH musí být 0, 12 nebo 21 %."],
      [6, "error", "Název má víc než 80 znaků."],
      [7, "error", "Cena musí být větší než 0 Kč."],
    ]);
    expect(p.items).toEqual([{ name: "Káva", price: 4500, vatRate: 21 }]);
    expect(p.counts).toEqual({ ok: 1, error: 5, duplicate: 0, skipped: 0 });
  });

  it("gate: duplicates – in the file (case and spaces ignored) and against the existing catalog", () => {
    const csv = "Název;Cena\nKáva;45\nKÁVA ;50\nČaj  zelený;35\nčaj zelený;35\nDort;89\n";
    const { p } = preview(utf8(csv), { vatPayer: false, existingNames: ["dort"] });
    expect(p.rows.map((r) => [r.name, r.status, r.message ?? ""])).toEqual([
      ["Káva", "ok", ""],
      ["KÁVA", "duplicate", "Stejný název je už na řádku 2."],
      ["Čaj zelený", "ok", ""],
      ["čaj zelený", "duplicate", "Stejný název je už na řádku 4."],
      ["Dort", "duplicate", "Položka s tímto názvem už v katalogu je."],
    ]);
    expect(p.items.map((i) => i.name)).toEqual(["Káva", "Čaj zelený"]);
    expect(nameKey("  Čaj   ZELENÝ ")).toBe("čaj zelený");
  });

  it("VAT: a non-payer always gets 0 % (notice); a payer's missing rate takes the chosen default (notice)", () => {
    const csv = "Název;Cena;DPH\nKáva;45;21\nČaj;35;\n";
    const non = preview(utf8(csv), { vatPayer: false }).p;
    expect(non.items.map((i) => i.vatRate)).toEqual([0, 0]);
    expect(non.notices.join(" ")).toContain("Nejste plátce DPH");
    const payer = preview(utf8(csv), { vatPayer: true, defaultVat: 12 }).p;
    expect(payer.items.map((i) => i.vatRate)).toEqual([21, 12]);
    expect(payer.notices.join(" ")).toContain("chybí sazba DPH – nastavíme 12 %");
  });

  it("items are grouped by category (first appearance), file order inside; the catalog cap trims with a notice", () => {
    const csv = "Název;Cena;Kategorie\nKáva;45;Nápoje\nRohlík;5;Pečivo\nČaj;35;Nápoje\nChléb;40;Pečivo\n";
    const { t, p } = preview(utf8(csv), { vatPayer: false });
    expect(p.items.map((i) => i.name)).toEqual(["Káva", "Čaj", "Rohlík", "Chléb"]);
    const capped = buildPreview(t, t.mapping, { vatPayer: false, existingCount: IMPORT_LIMITS.maxCatalog - 1 });
    expect(capped.items.map((i) => i.name)).toEqual(["Káva"]);
    expect(nb(capped.notices.join(" "))).toContain("Katalog pojme nejvýš 5 000 položek");
  });

  it("gate: file limits – over 2 000 rows, over 1 MB, .xlsx, header only", () => {
    const many = `Název;Cena\n${Array.from({ length: IMPORT_LIMITS.maxRows + 1 }, (_, i) => `Položka ${i};10`).join("\n")}`;
    expect(() => readImportFile(utf8(many))).toThrow(ImportFileError);
    expect(nb(errorOf(() => readImportFile(utf8(many))))).toContain("nejvýš 2 000");
    expect(readImportFile(utf8(`Název;Cena\n${Array.from({ length: IMPORT_LIMITS.maxRows }, (_, i) => `P${i};10`).join("\n")}`)).rows).toHaveLength(2000);
    expect(() => readImportFile(new Uint8Array(IMPORT_LIMITS.maxBytes + 1).fill(0x41))).toThrow(/1 MB/);
    expect(() => readImportFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toThrow(/xlsx/);
    expect(() => readImportFile(utf8("Název;Cena\n"))).toThrow(ImportFileError);
    expect(() => readImportFile(new Uint8Array())).toThrow(/prázdný/);
  });
});

describe("S2-E – presets from the vendors' documented exports", () => {
  it("gate: Dotykačka export (manual.dotykacka.cz) – columns recognised, deleted products skipped, net price → gross", () => {
    const csv =
      "categoryId;categoryName;productId;name;externalId;ean;plu;priceWithoutVAT;vat;priceWithVAT;deleted\n" +
      "1;Káva;10;Espresso;;8594001234567;1;;21;49,00;0\n" +
      "1;Káva;11;Cappuccino;;;;57,02;21;;0\n" +
      "2;Dorty;12;Starý dort;;;;;12;65;1\n";
    const { t, p } = preview(utf8(csv));
    expect(t.preset?.id).toBe("dotykacka");
    expect(t.mapping).toMatchObject({ name: 3, price: 9, priceNet: 7, vat: 8, category: 1, code: 5, deleted: 10 });
    expect(p.rows.map((r) => [r.name, r.price, r.vatRate, r.code, r.status])).toEqual([
      ["Espresso", 4900, 21, "8594001234567", "ok"],
      ["Cappuccino", 6899, 21, null, "ok"],
      ["Starý dort", null, 21, null, "skipped"],
    ]);
  });

  it("gate: SumUp export (help.sumup.com) – variants on the rows below the item become separate buttons", () => {
    const csv = "Item name,Variations,Price,Tax rate (%),Category,SKU,Barcode\nKošile,,,,Oblečení,,\n,M,450,21,,KS-M,\n,L,450,21,,KS-L,\nČepice,,199,21,Oblečení,,\n";
    const { t, p } = preview(utf8(csv));
    expect(t.preset?.id).toBe("sumup");
    expect(p.rows.map((r) => [r.name, r.status])).toEqual([
      ["Košile", "skipped"],
      ["Košile – M", "ok"],
      ["Košile – L", "ok"],
      ["Čepice", "ok"],
    ]);
    // S3-POKLADNA: varianta převezme kategorii položky; kód je ze sloupce Barcode (tady prázdný), SKU je jen náhradní sloupec
    expect(p.items).toEqual([
      { name: "Košile – M", price: 45000, vatRate: 21, category: "Oblečení" },
      { name: "Košile – L", price: 45000, vatRate: 21, category: "Oblečení" },
      { name: "Čepice", price: 19900, vatRate: 21, category: "Oblečení" },
    ]);
  });

  it("generic mapping – Czech and English headers, „bez DPH“ before plain price", () => {
    expect(guessMapping(["Kód", "Název zboží", "Cena bez DPH", "Cena s DPH (Kč)", "Sazba DPH v %", "Skupina"])).toEqual({ code: 0, name: 1, priceNet: 2, price: 3, vat: 4, category: 5 });
    expect(guessMapping(["Product name", "Price", "VAT rate", "Barcode"])).toEqual({ name: 0, price: 1, vat: 2, code: 3 });
  });
});

describe("S2-E – UI in the register settings", () => {
  it("gate: the catalog section offers „Importovat ze souboru“; the register gets a search box only for big catalogs", async () => {
    expect(readFileSync(new URL("../src/components/setup/setup-app.tsx", import.meta.url), "utf8")).toContain("<CatalogImport vatPayer={vatPayer} existing={items} onChange={reload} />");
    const { CatalogImport } = await import("@/components/setup/catalog-import");
    const html = renderToStaticMarkup(createElement(CatalogImport, { vatPayer: true, existing: [], onChange: async () => {} }));
    expect(html).toContain("Importovat ze souboru");
    const { RegisterScreen } = await import("@/components/pos/register-screen");
    const config = (n: number) =>
      ({
        account: { vatPayer: false },
        catalog: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Položka ${i}`, price: 100, vatRate: 0, color: null })),
      }) as never;
    const render = (n: number) => renderToStaticMarkup(createElement(RegisterScreen, { config: config(n), cart: [], setCart: () => {}, discount: 0, setDiscount: () => {}, onPay: () => {} }));
    expect(render(24)).not.toContain('aria-label="Hledat zboží"');
    const big = render(500);
    expect(big).toContain('aria-label="Hledat zboží"');
    expect(big.match(/Položka \d+<\/span>/g)?.length).toBe(60);
  });
});

describe("S2-E – API validation (schema and proxy)", () => {
  it("gate: CatalogImportInput – max 2 000 items, price > 0, VAT 0/12/21, name ≤ 80", async () => {
    const { CatalogImportInput, CatalogImportUndo } = await import("@/lib/server/schemas");
    const item = { name: "Káva", price: 4500, vatRate: 21 };
    expect(CatalogImportInput.safeParse({ items: [item] }).success).toBe(true);
    expect(CatalogImportInput.safeParse({ items: Array.from({ length: 2000 }, () => item) }).success).toBe(true);
    const tooMany = CatalogImportInput.safeParse({ items: Array.from({ length: 2001 }, () => item) });
    expect(tooMany.success).toBe(false);
    expect(tooMany.error?.issues[0]?.message).toBe("Najednou lze naimportovat nejvýš 2 000 položek");
    expect(CatalogImportInput.safeParse({ items: [] }).success).toBe(false);
    expect(CatalogImportInput.safeParse({ items: [{ ...item, price: 0 }] }).success).toBe(false);
    expect(CatalogImportInput.safeParse({ items: [{ ...item, price: 45.5 }] }).success).toBe(false);
    expect(CatalogImportInput.safeParse({ items: [{ ...item, vatRate: 15 }] }).success).toBe(false);
    expect(CatalogImportInput.safeParse({ items: [{ ...item, name: "x".repeat(81) }] }).success).toBe(false);
    expect(CatalogImportUndo.safeParse({ ids: ["not-a-uuid"] }).success).toBe(false);
  });

  it("gate: proxy – cross-site POST 403, body over 1 MB 413, text/plain 415; same-origin JSON passes", async () => {
    const { proxy } = await import("@/proxy");
    const post = (headers: Record<string, string>) => proxy(new NextRequest("http://localhost/api/ucet/katalog/import", { method: "POST", headers: { "content-length": "40", ...headers } }));
    expect(post({ origin: "https://evil.example", "content-type": "application/json" }).status).toBe(403);
    expect(post({ origin: "http://localhost", "content-type": "application/json", "content-length": String(IMPORT_LIMITS.maxBytes + 1) }).status).toBe(413);
    expect(post({ origin: "http://localhost", "content-type": "text/plain" }).status).toBe(415);
    expect(post({ origin: "http://localhost", "content-type": "application/json" }).status).toBe(200);
  });
});

describe("S2-E – API /api/ucet/katalog/import (PGlite)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
  }, 60_000);
  afterAll(async () => t?.close());
  beforeEach(async () => {
    await t.reset();
    sessionToken = null;
  });

  async function login() {
    const s = await seedAccount();
    sessionToken = randomUUID();
    await getDb().insert(schema.sessions).values({ tokenHash: sha256(sessionToken), userId: s.user.id, expiresAt: new Date(Date.now() + 3_600_000) });
    return s;
  }
  const req = (method: "POST" | "DELETE", body: unknown) => {
    const json = JSON.stringify(body);
    return new Request("http://localhost/api/ucet/katalog/import", {
      method,
      headers: { "content-type": "application/json", origin: "http://localhost", "content-length": String(Buffer.byteLength(json)) },
      body: json,
    });
  };
  const call = async (method: "POST" | "DELETE", body: unknown) => {
    const route = await import("@/app/api/ucet/katalog/import/route");
    const res = await route[method](req(method, body), { params: Promise.resolve({}) } as never);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const names = async (accountId: string) =>
    (await getDb().select().from(schema.catalogItems).where(eq(schema.catalogItems.accountId, accountId))).sort((a, b) => a.sort - b.sort).map((i) => [i.name, i.price, i.vatRate, i.sort]);

  it("gate: without a session 401; a cross-site request 403 before anything else", async () => {
    await seedAccount();
    expect((await call("POST", { items: [{ name: "Káva", price: 4500, vatRate: 21 }] })).status).toBe(401);
    const route = await import("@/app/api/ucet/katalog/import/route");
    const cross = new Request("http://localhost/api/ucet/katalog/import", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
    expect((await route.POST(cross, { params: Promise.resolve({}) } as never)).status).toBe(403);
  });

  it("gate: bulk insert after the existing buttons; names already in the catalog or repeated are skipped; undo deletes only these", async () => {
    const s = await login();
    await getDb().insert(schema.catalogItems).values({ accountId: s.account.id, name: "Káva", price: 4000, vatRate: 21, sort: 0 });
    const other = await seedAccount();
    const [foreign] = await getDb().insert(schema.catalogItems).values({ accountId: other.account.id, name: "Cizí", price: 100, vatRate: 21 }).returning();
    const r = await call("POST", {
      items: [
        { name: "KÁVA", price: 4500, vatRate: 21 },
        { name: "Čaj", price: 3500, vatRate: 12 },
        { name: "čaj ", price: 3600, vatRate: 12 },
        { name: "Dort", price: 8900, vatRate: 12 },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.created).toBe(2);
    expect(r.body.skipped).toEqual([
      { name: "KÁVA", reason: "duplicate" },
      { name: "čaj", reason: "duplicate" },
    ]);
    expect(await names(s.account.id)).toEqual([
      ["Káva", 4000, 21, 0],
      ["Čaj", 3500, 12, 1],
      ["Dort", 8900, 12, 2],
    ]);
    // vrácení smaže jen položky z importu a jen v tomto účtu
    const undo = await call("DELETE", { ids: [...(r.body.ids as string[]), foreign!.id] });
    expect(undo).toEqual({ status: 200, body: { deleted: 2 } });
    expect(await names(s.account.id)).toEqual([["Káva", 4000, 21, 0]]);
    expect(await names(other.account.id)).toEqual([["Cizí", 100, 21, 0]]);
  });

  it("gate: invalid items 400 (nothing saved); the catalog cap 400; a closed account 400", async () => {
    const s = await login();
    const bad = await call("POST", { items: [{ name: "Káva", price: 4500, vatRate: 21 }, { name: "Čaj", price: 0, vatRate: 21 }] });
    expect(bad.status).toBe(400);
    expect(await names(s.account.id)).toEqual([]);
    await getDb()
      .insert(schema.catalogItems)
      .values(Array.from({ length: IMPORT_LIMITS.maxCatalog - 1 }, (_, i) => ({ accountId: s.account.id, name: `P${i}`, price: 100, vatRate: 21, sort: i })));
    const cap = await call("POST", { items: [{ name: "Nová 1", price: 100, vatRate: 21 }, { name: "Nová 2", price: 100, vatRate: 21 }] });
    expect(cap.status).toBe(400);
    expect(nb(String(cap.body.error))).toContain("Katalog pojme nejvýš 5 000 položek");
    expect((await call("POST", { items: [{ name: "Nová 1", price: 100, vatRate: 21 }] })).status).toBe(200);
    await getDb().update(schema.accounts).set({ closedAt: new Date() }).where(eq(schema.accounts.id, s.account.id));
    expect(await call("POST", { items: [{ name: "Nová 3", price: 100, vatRate: 21 }] })).toEqual({ status: 400, body: { error: "Účet je zrušený." } });
  }, 30_000);

  it("gate: at most 10 imports per hour per account (429)", async () => {
    await login();
    for (let i = 0; i < 10; i++) expect((await call("POST", { items: [{ name: `Položka ${i}`, price: 100, vatRate: 21 }] })).status).toBe(200);
    const r = await call("POST", { items: [{ name: "Položka 11", price: 100, vatRate: 21 }] });
    expect(r.status).toBe(429);
  });
});

describe("S2-E – /prechod-z-jine-pokladny", () => {
  afterEach(() => {
    mockLaunch("closed");
  });

  it("gate: dated prices with a source for every commercial row; the comparison note; headline; 5 FAQ; sources; DIS+ guide", async () => {
    mockLaunch("closed");
    const { default: Page, metadata } = await import("@/app/(site)/prechod-z-jine-pokladny/page");
    const { POS_PRICES, POS_PRICE_SOURCES, PRICES_CHECKED, PRICES_CHECKED_LABEL } = await import("@/content/pos-prices");
    const html = renderToStaticMarkup(createElement(Page as FC));
    const text = nb(pageText(Page as FC));
    expect(PRICES_CHECKED).toBe("2026-10-17");
    expect(text).toContain("Proč platit za evidenci tržeb, když může být zdarma?");
    expect(text).toContain(`Zdroj (ověřeno ${PRICES_CHECKED_LABEL})`);
    expect(text).toContain("Ceny podle veřejných ceníků výrobců k 17. 10. 2026");
    expect(text).toContain("Jak srovnáváme:");
    for (const p of POS_PRICES) {
      expect(text).toContain(p.priceText);
      if (p.kind === "commercial") expect(p.sources.length, p.id).toBeGreaterThan(0);
    }
    for (const s of Object.values(POS_PRICE_SOURCES)) expect(html).toContain(`href="${s.url}"`);
    expect(text).toContain("590 Kč měsíčně bez DPH (713,90 Kč s DPH)");
    expect(text).toContain("297 Kč měsíčně bez DPH");
    expect(text).toContain("Ceník na webu nezveřejňuje");
    // co placené systémy nabízejí navíc
    for (const t of ["Sklad a receptury", "Rezervace a mapa stolů", "Platební terminál", "Věrnostní programy"]) expect(text).toContain(t);
    expect(html).toContain('href="/navody/jak-aktivovat-dis-a-certifikat"');
    expect((html.match(/<details/g) ?? []).length).toBe(5);
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"@type":"HowTo"');
    // externí odkazy jen přes ExternalLink (nová karta)
    for (const m of html.matchAll(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>/g)) expect(m[0], m[1]).toMatch(/target="_blank"[^>]*rel="noopener noreferrer"/);
    expect((metadata.description as string).length).toBeGreaterThanOrEqual(140);
    expect((metadata.description as string).length).toBeLessThanOrEqual(160);
    expect(metadata.robots).toBeUndefined();
  });

  it("gate: closed register – future tense (import from 2. 11. 2026), no present-tense claims", async () => {
    mockLaunch("closed");
    const { default: Page } = await import("@/app/(site)/prechod-z-jine-pokladny/page");
    const text = nb(pageText(Page as FC));
    expect(text).toContain("Od 2. 11. 2026 v nastavení pokladny (Rychlá tlačítka → Importovat ze souboru) soubor nahrajete");
    expect(text).toContain("pokladna EvidujZdarma, kterou spouštíme 2. 11. 2026");
    expect(text).toContain("Pokladnu spouštíme 2. 11. 2026");
    expect(text).not.toMatch(/[Ff]unguje i bez signálu|Začněte zdarma|Pokladna ale nemá/);
  });

  it("open (mock) – present tense comes back", async () => {
    mockLaunch("open");
    const { default: Page } = await import("@/app/(site)/prechod-z-jine-pokladny/page");
    const text = nb(pageText(Page as FC));
    expect(text).toContain("V nastavení pokladny (Rychlá tlačítka → Importovat ze souboru) soubor nahrajete");
    expect(text).not.toContain("Od 2. 11. 2026 v nastavení pokladny");
    expect(text).not.toContain("Spouštíme 2. 11. 2026");
  });

  it("gate: registered – STATIC_PAGES/sitemap, llms.txt, linked from /srovnani/moje-eet and /cenik; not a tool", async () => {
    mockLaunch("closed");
    const { STATIC_PAGES } = await import("@/lib/static-pages");
    const { absoluteUrl } = await import("@/lib/site");
    expect(STATIC_PAGES.find((p) => p.path === "/prechod-z-jine-pokladny")?.modified).toBe("2026-10-17");
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().map((e) => e.url)).toContain(absoluteUrl("/prechod-z-jine-pokladny"));
    const { llmsTxt } = await import("@/lib/llms");
    expect(llmsTxt()).toContain(absoluteUrl("/prechod-z-jine-pokladny"));
    const pages: [string, FC][] = [
      ["/srovnani/moje-eet", (await import("@/app/(site)/srovnani/moje-eet/page")).default as FC],
      ["/cenik", (await import("@/app/(site)/cenik/page")).default as FC],
    ];
    for (const [p, C] of pages) expect(renderToStaticMarkup(createElement(C)), p).toContain('href="/prechod-z-jine-pokladny"');
    expect(readFileSync(new URL("../src/app/(site)/nastroje/page.tsx", import.meta.url), "utf8")).not.toContain("/prechod-z-jine-pokladny");
  });

  it("calculator: X Kč monthly → 12× per year; a non-payer adds 21 % VAT; no browser storage in the new components", async () => {
    const { yearlyCost, CALCULATOR_PRESETS } = await import("@/content/pos-prices");
    expect(yearlyCost(590, { addVat: false })).toEqual({ monthly: 590, year: 7080, threeYears: 21240 });
    expect(yearlyCost(590, { addVat: true })).toEqual({ monthly: 713.9, year: 8566.8, threeYears: 25700.4 });
    expect(yearlyCost(-5, { addVat: false }).year).toBe(0);
    expect(CALCULATOR_PRESETS.map((p) => p.monthly)).toEqual([190, 297, 590]);
    for (const f of ["components/switch-cost-calculator.tsx", "components/setup/catalog-import.tsx", "lib/pos/import-products.ts"]) {
      expect(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"), f).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
    }
  });
});
