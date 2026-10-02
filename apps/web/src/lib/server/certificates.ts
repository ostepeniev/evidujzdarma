import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { buildSale } from "@ez/fiscal-core";
import { CertificateError, parseP12 } from "@ez/fiscal-core/server";
import { HttpError } from "./auth";
import { accountMode, storeCertificate, transportFor, type EetMode } from "./fiscal";

export type CertEnvironment = "playground" | "production";

/** Prostředí podle vydavatele certifikátu: testovací certifikáty vydává CA s „Playground“ v názvu. */
export function environmentFromIssuer(issuer: string): CertEnvironment {
  return /playground/i.test(issuer) ? "playground" : "production";
}

const ENV_LABEL: Record<CertEnvironment, string> = { production: "ostrý", playground: "testovací (Playground)" };
/** Tolerance rozdílu hodin při kontrole „platný od“. */
const CLOCK_SKEW_MS = 5 * 60_000;

/**
 * Import .p12 – fail-closed (R1.9): bez EIČ v certifikátu, s jiným EIČ než účet, s nesouhlasem
 * prostředí nebo mimo platnost se nic neuloží. Výměna certifikátu je atomická.
 */
export async function importCertificate(accountId: string, input: { file: Buffer; password: string; expected?: CertEnvironment }) {
  let cert;
  try {
    cert = parseP12(input.file, input.password);
  } catch (e) {
    throw new HttpError(400, e instanceof CertificateError ? e.message : "Certifikát se nepodařilo načíst.");
  }
  const now = Date.now();
  if (cert.info.validTo.getTime() <= now) throw new HttpError(400, "Certifikát už není platný. Vygenerujte nový v DIS+.");
  if (cert.info.validFrom.getTime() > now + CLOCK_SKEW_MS) throw new HttpError(400, `Certifikát platí až od ${cert.info.validFrom.toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}.`);
  if (!cert.info.dic) throw new HttpError(400, "Z certifikátu nejde zjistit EIČ (DIČ). Nahrajte pokladní certifikát vydaný v DIS+.");

  const environment = environmentFromIssuer(cert.info.issuer);
  if (input.expected && input.expected !== environment) {
    throw new HttpError(400, `Tento certifikát je ${ENV_LABEL[environment]}, ne ${ENV_LABEL[input.expected]}. Vydavatel: ${cert.info.issuer}.`);
  }

  const account = await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  if (!account) throw new HttpError(404, "Účet neexistuje");
  const accountEic = account.eic ?? account.dic;
  if (accountEic && cert.info.dic !== accountEic) {
    throw new HttpError(400, `Certifikát patří EIČ ${cert.info.dic}, ale u účtu je ${accountEic}. Zkontrolujte EIČ v nastavení.`);
  }

  const id = await storeCertificate(accountId, cert, environment, accountEic ? {} : { setAccountEic: cert.info.dic });
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
  if (result.ok && cert) await db.update(schema.certificates).set({ verifiedAt: new Date() }).where(eq(schema.certificates.id, cert.id));
  if (result.ok) return { ok: true as const, mode, test: result.test, warnings: result.warnings };
  return { ok: false as const, mode, code: result.code, message: result.message, retryable: result.retryable };
}
