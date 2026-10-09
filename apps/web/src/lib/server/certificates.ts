import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { buildSale, certificateEnvironment } from "@ez/fiscal-core";
import { CertificateError, caEetIssuer, parseP12Safe } from "@ez/fiscal-core/server";
import { HttpError } from "./auth";
import { notifyOwners } from "./account";
import { rateLimit } from "./rate-limit";
import { accountMode, requeueBlocked, storeCertificate, transportFor, type EetMode } from "./fiscal";

export type CertEnvironment = "playground" | "production";


const ENV_LABEL: Record<CertEnvironment, string> = { production: "ostrý", playground: "testovací (Playground)" };
/** Tolerance rozdílu hodin při kontrole „platný od“. */
const CLOCK_SKEW_MS = 5 * 60_000;

/** Účet v ostrém provozu s certifikátem z neprodukční CA EET (R12.2, doslovně z рецензії №9). */
export const CA_EET_TEST_ENV_MESSAGE = "Certifikát je z testovacího prostředí EET. Pro ostrý provoz si vygenerujte certifikát v produkčním DIS+.";
/** Jméno vydavatele z CA EET, ale podpis řetězce nesedí (R13.2, doslovně z рецензії №11). */
export const CA_EET_FORGED_MESSAGE =
  "Certifikát se nepodařilo ověřit: jeho podpis neodpovídá certifikační autoritě EET. Nahrajte soubor .p12 tak, jak jste ho stáhli z DIS+, nebo si v DIS+ vygenerujte nový certifikát.";

/**
 * Import .p12 – fail-closed (R1.9): bez EIČ v certifikátu, s jiným EIČ než účet, s nesouhlasem
 * prostředí nebo mimo platnost se nic neuloží. Výměna certifikátu je atomická.
 * Účet v ostrém provozu přijme z CA EET (ověřeno podpisem řetězce, R12.2) produkční certifikát a Playground certifikát
 * s Policy OID Playground – ten jen pro ověření (R13.1).
 */
export async function importCertificate(accountId: string, input: { file: Buffer; password: string; expected?: CertEnvironment }) {
  let cert;
  try {
    // limity iterací + worker s časovým limitem – soubor nesmí zablokovat server (R3.1)
    cert = await parseP12Safe(input.file, input.password);
  } catch (e) {
    throw new HttpError(400, e instanceof CertificateError ? e.message : "Certifikát se nepodařilo načíst.");
  }
  const now = Date.now();
  if (cert.info.validTo.getTime() <= now) throw new HttpError(400, "Certifikát už není platný. Vygenerujte nový v DIS+.");
  if (cert.info.validFrom.getTime() > now + CLOCK_SKEW_MS) throw new HttpError(400, `Certifikát platí až od ${cert.info.validFrom.toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}.`);
  if (!cert.info.dic) throw new HttpError(400, "Z certifikátu nejde zjistit EIČ (DIČ). Nahrajte pokladní certifikát vydaný v DIS+.");

  const account = await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  if (!account) throw new HttpError(404, "Účet neexistuje");
  if (account.closedAt) throw new HttpError(400, "Účet je zrušený.");

  // prostředí podle Policy OID pokladního certifikátu (produkce 3.1.2, Playground 3.1.5; R5.9), ne podle názvu vydavatele
  const environment = certificateEnvironment(cert.info.policies);

  // CA EET (R12.2, R13.1): ostrý účet – řetězec ověřený podpisem list → SubCA → Root × Policy OID:
  //  prod → jako dosud; playground s OID Playground → uloží se jako playground pro ověření (ostré tržby ho nepoužijí);
  //  playground s jiným OID, zkušební a testovací → odmítnout. Vydavatel mimo CA EET → jako dosud (rozhoduje Policy OID);
  //  Playground a ukázkový režim beze změny.
  if (accountMode(account) === "production") {
    const ca = caEetIssuer(cert.certificatePem);
    const allowed = ca.environment === "prod" || (ca.environment === "playground" && environment === "playground");
    if (ca.environment && !allowed) throw new HttpError(400, CA_EET_TEST_ENV_MESSAGE);
    // jméno vydavatele CA EET bez platného podpisu – certifikát nepochází od CA EET
    if (!ca.environment && ca.nameMatch) throw new HttpError(400, CA_EET_FORGED_MESSAGE);
  }

  if (!environment) {
    throw new HttpError(400, "Certifikát nemá politiku pokladního certifikátu EET 2.0. Nahrajte pokladní certifikát vydaný v DIS+ (ostrý nebo pro Playground).");
  }
  if (input.expected && input.expected !== environment) {
    throw new HttpError(400, `Tento certifikát je ${ENV_LABEL[environment]}, ne ${ENV_LABEL[input.expected]}. Vydavatel: ${cert.info.issuer}.`);
  }

  const accountEic = account.eic ?? account.dic;
  if (accountEic && cert.info.dic !== accountEic) {
    throw new HttpError(400, `Certifikát patří EIČ ${cert.info.dic}, ale u účtu je ${accountEic}. Zkontrolujte EIČ v nastavení.`);
  }

  const id = await storeCertificate(accountId, cert, environment, accountEic ? {} : { setAccountEic: cert.info.dic });
  // bezpečnostní upozornění vlastníkům (B Дрібне 2)
  await notifyOwners(
    accountId,
    `certificate-uploaded:${id}`,
    `Nahrán pokladní certifikát (${ENV_LABEL[environment]})`,
    `K vašemu účtu byl nahrán pokladní certifikát pro EIČ ${cert.info.dic} (${ENV_LABEL[environment]}, platí do ${cert.info.validTo.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" })}). Pokud jste to nebyli vy, ozvěte se nám a v DIS+ certifikát zneplatněte.`,
    "/pokladna/nastaveni#certifikat",
  );
  return { id, subject: cert.info.subject, eic: cert.info.dic, environment, issuer: cert.info.issuer, validFrom: cert.info.validFrom, validTo: cert.info.validTo };
}

/** Prostředí pro ověření: zvolené, jinak aktuální režim účtu, jinak ostrý (je-li certifikát), jinak Playground. */
async function defaultEnvironment(accountId: string, mode: EetMode): Promise<EetMode> {
  if (mode !== "mock") return mode;
  const certs = await getDb()
    .select({ environment: schema.certificates.environment })
    .from(schema.certificates)
    .where(and(eq(schema.certificates.accountId, accountId), isNull(schema.certificates.revokedAt)));
  if (certs.some((c) => c.environment === "production")) return "production";
  if (certs.some((c) => c.environment === "playground")) return "playground";
  return "mock";
}

/**
 * Ověřovací odeslání (overeni=true): Finanční správa zprávu zkontroluje (certifikát, EIČ, číslo
 * jednotky), ale tržbu neeviduje. Úspěch se zapíše k aktivnímu certifikátu daného prostředí.
 */
export async function verifyEnvironment(accountId: string, unitId: string, requested?: EetMode) {
  // každé ověření je zpráva do FS: nejvýš 6 za 10 minut na účet (A Дрібне 13)
  if (!rateLimit(`overeni:${accountId}`, 6, 600)) throw new HttpError(429, "Ověřovacích odeslání bylo teď příliš mnoho. Zkuste to za pár minut.");
  const db = getDb();
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  if (!account) throw new HttpError(404, "Účet neexistuje");
  const unit = await db.query.evidenceUnits.findFirst({ where: and(eq(schema.evidenceUnits.id, unitId), eq(schema.evidenceUnits.accountId, accountId)) });
  if (!unit) throw new HttpError(404, "Jednotka nenalezena");
  const mode = requested ?? (await defaultEnvironment(accountId, accountMode(account)));
  if (mode !== "mock" && !unit.fsUnitId) throw new HttpError(400, "Jednotka nemá číslo přidělené Finanční správou.");
  const eic = account.eic ?? account.dic;
  if (!eic) throw new HttpError(400, "Vyplňte EIČ (DIČ).");
  const cert =
    mode === "mock"
      ? undefined
      : await db.query.certificates.findFirst({
          where: and(eq(schema.certificates.accountId, accountId), eq(schema.certificates.environment, mode), isNull(schema.certificates.revokedAt)),
          orderBy: desc(schema.certificates.createdAt),
        });
  if (mode !== "mock" && !cert) throw new HttpError(400, mode === "production" ? "Nahrajte ostrý pokladní certifikát z DIS+." : "Nahrajte testovací certifikát pro Playground.");

  const now = new Date();
  const sale = buildSale({
    id: randomUUID(),
    deviceId: "verification",
    registerId: "OVERENI",
    unitId: String(unit.fsUnitId ?? 1),
    sequence: `OVERENI-${now.getTime()}`.slice(0, 25),
    soldAt: now.toISOString(),
    lines: [{ name: "Ověření", qty: 1, unitPrice: 100, vatRate: 0 }],
    payments: [{ method: "cash", amount: 100 }],
    vatPayer: false,
    mode: "test",
  });
  const result = await transportFor(account, mode).send(sale, { firstAttempt: true, verifyOnly: true, eic });
  if (result.ok && cert) {
    await db.update(schema.certificates).set({ verifiedAt: new Date() }).where(eq(schema.certificates.id, cert.id));
    // ostré tržby čekající na ověření nového certifikátu (Д-6) se hned vrátí do fronty
    await requeueBlocked(accountId, ["CERT_NOT_VERIFIED"], mode);
  }
  // ukázkový režim nic do FS neposílá – výsledek je jen simulace, ne ověření certifikátu (A Дрібне 13)
  if (result.ok) return { ok: true as const, mode, test: result.test, warnings: result.warnings, ...(mode === "mock" ? { simulated: true as const } : {}) };
  return { ok: false as const, mode, code: result.code, message: result.message, retryable: result.retryable };
}
