import "server-only";
import { and, asc, desc, eq, gt, isNull, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { isValidIco, normalizeIco, toIban } from "@ez/cz";
import { getDb, schema } from "@ez/db";
import { HttpError, type CurrentUser } from "./auth";
import { ACCOUNT_BLOCKS, requeueBlocked } from "./fiscal";
import { randomToken, sha256 } from "./tokens";

export const FREE_LIMITS = { staff: 5, units: 3, devices: 10 } as const;

export function limitsFor(plan: string) {
  return plan === "free" ? FREE_LIMITS : { staff: 100, units: 100, devices: 100 };
}

/** Kompletní stav účtu pro nastavení pokladny (bez tajných hodnot). */
export async function accountState(user: CurrentUser) {
  const db = getDb();
  const owner = user.memberships.find((m) => m.role === "owner" && m.accountKind === "business");
  if (!owner) return { user: { email: user.email }, account: null };
  const account = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, owner.accountId) }))!;
  const [units, staff, catalog, devices, certificates, salesCount] = await Promise.all([
    db.select().from(schema.evidenceUnits).where(eq(schema.evidenceUnits.accountId, account.id)).orderBy(asc(schema.evidenceUnits.createdAt)),
    db
      .select({ id: schema.staff.id, name: schema.staff.name, role: schema.staff.role, active: schema.staff.active, hasPin: sql<boolean>`${schema.staff.pinHash} is not null` })
      .from(schema.staff)
      .where(eq(schema.staff.accountId, account.id))
      .orderBy(asc(schema.staff.createdAt)),
    db.select().from(schema.catalogItems).where(eq(schema.catalogItems.accountId, account.id)).orderBy(asc(schema.catalogItems.sort), asc(schema.catalogItems.name)),
    db
      .select({
        id: schema.devices.id,
        name: schema.devices.name,
        registerId: schema.devices.registerId,
        unitId: schema.devices.unitId,
        lastSeenAt: schema.devices.lastSeenAt,
        revokedAt: schema.devices.revokedAt,
      })
      .from(schema.devices)
      .where(eq(schema.devices.accountId, account.id))
      .orderBy(desc(schema.devices.createdAt)),
    db
      .select({
        id: schema.certificates.id,
        subject: schema.certificates.subject,
        eic: schema.certificates.eic,
        environment: schema.certificates.environment,
        validFrom: schema.certificates.validFrom,
        validTo: schema.certificates.validTo,
      })
      .from(schema.certificates)
      .where(and(eq(schema.certificates.accountId, account.id), isNull(schema.certificates.revokedAt), gt(schema.certificates.validTo, new Date())))
      .orderBy(desc(schema.certificates.createdAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.sales).where(eq(schema.sales.accountId, account.id)),
  ]);
  return {
    user: { email: user.email },
    account,
    limits: limitsFor(account.plan),
    units,
    staff,
    catalog,
    devices: devices.filter((d) => !d.revokedAt),
    certificates,
    salesCount: salesCount[0]?.n ?? 0,
  };
}

export const AccountInput = z.object({
  name: z.string().trim().min(2).max(200),
  ico: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizeIco(v) : null))
    .refine((v) => v === null || isValidIco(v), "Neplatné IČO"),
  dic: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^CZ\d{8,10}$/.test(v), "DIČ ve tvaru CZ12345678"),
  eic: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^CZ\d{8,10}$/.test(v), "EIČ ve tvaru CZ + 8–10 číslic"),
  vatPayer: z.boolean().default(false),
  iban: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? toIban(v) : null)),
  receiptHeader: z.string().trim().max(300).optional().nullable(),
  receiptFooter: z.string().trim().max(300).optional().nullable(),
  receiptShowPok: z.boolean().optional(),
  ownerName: z.string().trim().min(1).max(80).optional(),
});

export async function upsertAccount(user: CurrentUser, input: z.infer<typeof AccountInput>) {
  const db = getDb();
  const owner = user.memberships.find((m) => m.role === "owner" && m.accountKind === "business");
  const values = {
    name: input.name,
    ico: input.ico,
    dic: input.dic,
    eic: input.eic ?? input.dic,
    vatPayer: input.vatPayer,
    iban: input.iban,
    // nevyplněné pole formuláře nesmí přepsat uložené hodnoty
    ...(input.receiptHeader !== undefined ? { receiptHeader: input.receiptHeader } : {}),
    receiptFooter: input.receiptFooter ?? null,
    ...(input.receiptShowPok !== undefined ? { receiptShowPok: input.receiptShowPok } : {}),
  };
  if (owner) {
    const before = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, owner.accountId), columns: { eic: true, dic: true } });
    await db.update(schema.accounts).set(values).where(eq(schema.accounts.id, owner.accountId));
    // Opravené EIČ uvolní tržby zablokované kvůli údajům účtu. Už odeslané tržby si drží svůj snímek (Р4).
    if ((before?.eic ?? before?.dic) !== (values.eic ?? values.dic)) {
      await requeueBlocked(owner.accountId, ACCOUNT_BLOCKS);
    }
    return owner.accountId;
  }
  return db.transaction(async (tx) => {
    const [acc] = await tx.insert(schema.accounts).values({ ...values, kind: "business" }).returning({ id: schema.accounts.id });
    await tx.insert(schema.memberships).values({ accountId: acc!.id, userId: user.id, role: "owner" });
    await tx.insert(schema.staff).values({ accountId: acc!.id, name: input.ownerName ?? "Vlastník", role: "owner" });
    return acc!.id;
  });
}

/** Tržby, které ještě nemají konečný stav – patří k režimu, ve kterém vznikly. */
export async function unsettledByMode(accountId: string) {
  return getDb()
    .select({ mode: schema.sales.mode, count: sql<number>`count(*)::int`, oldest: sql<string>`min(${schema.sales.soldAt})::text` })
    .from(schema.sales)
    .where(and(eq(schema.sales.accountId, accountId), inArray(schema.sales.status, ["queued", "sending", "failed", "rejected"])))
    .groupBy(schema.sales.mode);
}

export async function setEetMode(accountId: string, mode: "mock" | "playground" | "production", opts: { confirm?: boolean } = {}) {
  const db = getDb();
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  if (!account) throw new HttpError(404, "Účet neexistuje");
  if (account.eetMode !== mode && !opts.confirm) {
    // Přepnutí nemění režim už prodaných tržeb (Р3) – ale vlastník o nich musí vědět.
    const pending = (await unsettledByMode(accountId)).filter((p) => p.count > 0);
    if (pending.length) {
      throw new HttpError(409, "Některé tržby ještě nejsou vyřízené. Odešlou se v režimu, ve kterém vznikly. Potvrďte přepnutí.", { pending });
    }
  }
  if (mode !== "mock") {
    if (!(account.eic ?? account.dic)) throw new HttpError(400, "Nejdřív vyplňte EIČ (DIČ).");
    const cert = await db.query.certificates.findFirst({
      where: and(
        eq(schema.certificates.accountId, accountId),
        eq(schema.certificates.environment, mode),
        isNull(schema.certificates.revokedAt),
        gt(schema.certificates.validTo, new Date()),
      ),
    });
    if (!cert) throw new HttpError(400, mode === "production" ? "Nahrajte platný pokladní certifikát z DIS+." : "Nahrajte testovací certifikát pro Playground.");
    const units = await db.select().from(schema.evidenceUnits).where(and(eq(schema.evidenceUnits.accountId, accountId), eq(schema.evidenceUnits.active, true)));
    if (!units.length) throw new HttpError(400, "Přidejte alespoň jednu evidenční jednotku.");
    if (units.some((u) => !u.fsUnitId)) throw new HttpError(400, "Všechny evidenční jednotky musí mít číslo přidělené Finanční správou.");
  }
  await db.update(schema.accounts).set({ eetMode: mode }).where(eq(schema.accounts.id, accountId));
}

/** Registrace zařízení — token se vrací jen jednou, v DB je jen jeho hash. */
export async function registerDevice(accountId: string, input: { name: string; registerId: string; unitId: string | null }) {
  const db = getDb();
  const account = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) }))!;
  const active = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.devices)
    .where(and(eq(schema.devices.accountId, accountId), isNull(schema.devices.revokedAt)));
  if ((active[0]?.n ?? 0) >= limitsFor(account.plan).devices) throw new HttpError(400, "Dosáhli jste limitu zařízení.");
  if (!/^[0-9a-zA-Z.,:;/#\-_ ]{1,20}$/.test(input.registerId)) throw new HttpError(400, "Označení pokladny: max. 20 znaků (písmena, číslice, - _ / .)");
  if (input.unitId) {
    const unit = await db.query.evidenceUnits.findFirst({ where: and(eq(schema.evidenceUnits.id, input.unitId), eq(schema.evidenceUnits.accountId, accountId)) });
    if (!unit) throw new HttpError(400, "Neznámá evidenční jednotka");
  }
  const token = randomToken(32);
  const existing = await db.query.devices.findFirst({ where: and(eq(schema.devices.accountId, accountId), eq(schema.devices.registerId, input.registerId)) });
  if (existing && !existing.revokedAt) throw new HttpError(409, "Pokladna s tímto označením už existuje. Zvolte jiné označení.");
  // Prefix pořadových čísel je pro každou registraci jiný — po přeinstalaci zařízení
  // (nový čítač od 1) se pořadová čísla nikdy nezopakují.
  const prefix = `${input.registerId.replace(/[^0-9A-Za-z]/g, "").slice(0, 6) || "P"}-${randomToken(3).replace(/[^0-9A-Za-z]/g, "x").slice(0, 4).toUpperCase()}-`;
  let deviceId: string;
  if (existing) {
    // znovupoužití označení po odpojení: nový token, stejné ID pokladny
    await db
      .update(schema.devices)
      .set({ tokenHash: sha256(token), revokedAt: null, name: input.name, unitId: input.unitId, sequencePrefix: prefix })
      .where(eq(schema.devices.id, existing.id));
    deviceId = existing.id;
  } else {
    const [d] = await db
      .insert(schema.devices)
      .values({ accountId, name: input.name, registerId: input.registerId, unitId: input.unitId, tokenHash: sha256(token), sequencePrefix: prefix })
      .returning({ id: schema.devices.id });
    deviceId = d!.id;
  }
  return { deviceId, token };
}
