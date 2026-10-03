/**
 * R8.3 (рецензія №5, B-r5 розд. 3.3) – české texty doslovně z recenze: režimy v 6. pádě („v ostrém provozu“), tržba se
 * neprodává („původní prodej proběhl“), žádost „o …“ ve 4. pádě, slovosled, čísla, neutrální „e-mail s dalším krokem“.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MODE_IN } from "@/lib/modes";
import { INTEREST_LABEL, INTEREST_REQUEST } from "@/lib/interests";
import { renderEmail } from "@/lib/emails";
import { refundBlockedReason } from "@/lib/pos/sale-factory";
import { revokedNotice } from "@/lib/pos/revoked";
import type { LocalSale } from "@/lib/pos/types";
import { hashPin } from "@/lib/pos/pin";
import { closeAccount } from "@/lib/server/lifecycle";
import { QUARANTINE_REASON_TEXT } from "@/lib/server/quarantine";
import { ingestSales } from "@/lib/server/sales";
import { verifyStaffPinOnline } from "@/lib/server/staff-pin";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { pageText } from "../helpers/render-text";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const SRC = new URL("../../src", import.meta.url).pathname;
const src = (p: string) => readFileSync(join(SRC, p), "utf8");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
  });
}

describe("R8.3 – Czech texts (verbatim from the review)", () => {
  it("gate: modes in the locative case", () => {
    expect(MODE_IN).toEqual({ mock: "v ukázkovém režimu", playground: "v režimu Playground", production: "v ostrém provozu" });
  });

  it("gate: refund in another mode – server reason, quarantine text and the register", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
    const orig = deviceSale(s.unit.id, { mode: "playground", soldAt: new Date(Date.now() - 3_600_000).toISOString() });
    await ingestSales(await deviceContext(s.device.id), [orig as never]);
    await getDb().update(schema.accounts).set({ eetMode: "production", eetModeChangedAt: new Date(Date.now() - 60_000) }).where(eq(schema.accounts.id, s.account.id));
    const ctx = await deviceContext(s.device.id);
    const approval = (await verifyStaffPinOnline(ctx, s.owner.id, "246813", "refund", { refundOf: orig.id, amount: 35000 })).approval!;
    const x = deviceSale(s.unit.id, { mode: "production", lines: [{ name: "Střih", qty: -1, unitPrice: 35000, vatRate: 21 }], payments: [{ method: "cash", amount: -35000 }], refundOf: orig.id, staffId: s.owner.id, approval });
    const [r] = await ingestSales(ctx, [x as never]);
    expect(r).toMatchObject({ code: "REFUND_MODE_MISMATCH", error: "Vratka je v ostrém provozu, ale původní prodej proběhl v režimu Playground. Pokladna ji neodešle – vyřiďte ji ručně." });
    expect(QUARANTINE_REASON_TEXT.REFUND_MODE_MISMATCH).toBe("Vratka je v jiném režimu než původní prodej – pokladna ji neodešle. Vyřiďte ji ručně.");
    expect(refundBlockedReason({ mode: "playground" } as LocalSale, "production")).toBe("Původní prodej proběhl v režimu Playground. Vratku k němu pokladna neodešle.");
    expect(refundBlockedReason({ mode: "mock" } as LocalSale, "production")).toBe("Původní prodej proběhl v ukázkovém režimu. Vratku k němu pokladna neodešle.");
  });

  it("gate: MODE_MISMATCH and ACCOUNT_CLOSED reasons", async () => {
    const s = await seedAccount({ mode: "production" });
    const [mm] = await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "mock", soldAt: new Date(Date.now() + 1000).toISOString() }) as never]);
    expect(mm).toMatchObject({ code: "MODE_MISMATCH" });
    expect((mm as { error: string }).error).toMatch(/^Tržba je v ukázkovém režimu, ale účet je od .+ v ostrém provozu\. Pokladna měla staré nastavení\.$/);

    const c = await seedAccount({ mode: "mock" });
    await closeAccount(c.account.id, { confirm: true });
    const [closed] = await ingestSales(await deviceContext(c.device.id), [deviceSale(c.unit.id, { soldAt: new Date(Date.now() + 2000).toISOString() }) as never]);
    expect(closed).toMatchObject({ code: "ACCOUNT_CLOSED", error: "Účet je zrušený – prodej po zrušení účtu se Finanční správě neodešle." });
    expect(QUARANTINE_REASON_TEXT.ACCOUNT_CLOSED).toBe("Účet je zrušený – prodej po zrušení účtu se Finanční správě neodešle.");
  });

  it("gate: closed-unsent mail ends with the settings sentence", async () => {
    const s = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 120_000).toISOString() }) as never]);
    await closeAccount(s.account.id, { confirm: true });
    await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 60_000).toISOString() }) as never]);
    const [m] = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, s.user.email)).then((rows) => rows.filter((x) => x.dedupeKey?.startsWith("closed-unsent:")));
    expect((m!.payload as { text: string }).text).toMatch(/Evidujte ji jinak \(např\. v aplikaci MOJE eet\) a potom ji v nastavení pokladny označte „Evidováno jinak“\.$/);
  });

  it("gate: interests – request labels, singular webinar, interest-confirm e-mail and /registrace/zajem", () => {
    expect(INTEREST_REQUEST).toEqual({
      pokladna: "o předregistraci k pokladně EvidujZdarma",
      webinar: "o přihlášení na webinář EET 2.0 pro účetní",
      kabinet: "o zprávu o spuštění Účetního kabinetu",
    });
    expect(INTEREST_LABEL.webinar).toBe("přihláška na webinář EET 2.0 pro účetní");
    const mail = renderEmail("interest-confirm", { interest: "kabinet", confirmToken: "t".repeat(32), unsubscribeToken: "u".repeat(32) });
    expect(mail.text).toContain("pro tento e-mail jsme dostali žádost o zprávu o spuštění Účetního kabinetu. Potvrďte ji prosím: https://");
    expect(mail.html).toContain("pro tento e-mail jsme dostali žádost o zprávu o spuštění Účetního kabinetu.");
    expect(src("app/(site)/registrace/zajem/page.tsx")).toContain("Žádost {INTEREST_REQUEST[result.campaign]}. {INTEREST_NEXT[result.campaign]}");
  });

  it("gate: already-confirmed reminder, status page, forms", () => {
    const mail = renderEmail("prereg-confirm", { alreadyConfirmed: true, confirmToken: "t".repeat(32), unsubscribeToken: "u".repeat(32), referralCode: "abcd1234" });
    expect(mail.text).toContain("tento e-mail je u nás už předregistrovaný a potvrzený. Stav předregistrace najdete zde:");
    expect(mail.html).toContain("tento e-mail je u nás už předregistrovaný a potvrzený. Stav předregistrace najdete zde:");
    const status = src("app/(site)/registrace/potvrzeni/page.tsx");
    expect(status).toContain('"Až pokladnu spustíme, pošleme vám odkaz."');
    expect(status).not.toContain("Pak vám pošleme včasný přístup k pokladně.");
    expect(status).toContain("}. {INTEREST_NEXT[i]}");
    const webinar = src("components/accountant/webinar-form.tsx");
    expect(webinar.replace(/\s+/g, " ")).toContain(
      'E-mail a IČO použijeme jen k vyřízení vaší žádosti (webinář nebo zpráva o spuštění Účetního kabinetu). Podrobnosti najdete v{" "} <a href="/ochrana-osobnich-udaju" className="underline"> zásadách ochrany osobních údajů </a> .',
    );
    expect(webinar).toContain("Poslali jsme vám e-mail s dalším krokem.");
    expect(src("components/prereg-form.tsx")).toContain("e-mail s dalším krokem.");
  });

  it("gate: privacy policy purpose, data and the summary sentence", async () => {
    const { default: Zasady } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    const z = pageText(Zasady);
    expect(z).toContain("Předregistrace k pokladně, přihláška na webinář a zájem o Účetní kabinet");
    expect(z).toContain(", u webinářů a Účetního kabinetu, o co máte zájem.");
    expect(z).not.toContain("u webináře jeho termín");
    expect(z).toContain("Katalog firem z veřejných registrů připravujeme; fyzickým osobám v něm nebudeme zobrazovat adresu bydliště. Proti zpracování můžete kdykoli vznést námitku.");
    expect(src("app/(site)/ochrana-osobnich-udaju/page.tsx")).toMatch(/kdykoli vznést\s*<Link href="\/namitka">námitku<\/Link>\./);
  });

  it("gate: the register of a closed account – 'Odebrat registraci' confirmation (N17)", () => {
    expect(src("components/pos/pos-app.tsx")).toContain('"Tržby zůstanou uložené v zařízení. Do zrušeného účtu je už předat nejde."');
    expect(src("components/pos/pos-app.tsx")).toMatch(/revoked\.canRegister\s*\?\s*"Zůstanou uložené, ale Finanční správě se odešlou až po nové registraci pokladny\."/);
    expect(revokedNotice("Účet je zrušený a pokladna je odpojená.").text).toBe("Účet je zrušený a pokladna je odpojená. Tržby, které v zařízení zůstaly, už do účtu předat nejde.");
  });

  it("gate: no 'byla prodána', 'tržba prodaná', 'v režimu ukázkový' anywhere in src", () => {
    const hits: string[] = [];
    for (const f of files(SRC)) {
      const text = readFileSync(f, "utf8");
      for (const bad of ["byla prodána", "tržba prodaná", "v režimu ukázkový"]) if (text.includes(bad)) hits.push(`${f.slice(SRC.length + 1)}: ${bad}`);
    }
    expect(hits).toEqual([]);
  });
});
