import "server-only";
import { and, asc, desc, eq, gt, isNull, ne, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { isValidIco, normalizeIco, toIban } from "@ez/cz";
import { getDb, schema } from "@ez/db";
import { HttpError, type CurrentUser } from "./auth";
import { RETENTION, TERMS_VERSION } from "@/lib/legal";
import { ACCOUNT_BLOCKS, productionAcceptsFrom, requeueBlocked } from "./fiscal";
import { closedDeleteBy, linkedAccountants, unsentProductionOf, unsentView } from "./lifecycle";
import { randomToken, sha256 } from "./tokens";

export const FREE_LIMITS = { staff: 5, units: 3, devices: 10 } as const;

export function limitsFor(plan: string) {
  return plan === "free" ? FREE_LIMITS : { staff: 100, units: 100, devices: 100 };
}

/** Kompletní stav účtu pro nastavení pokladny (bez tajných hodnot). */
export async function accountState(user: CurrentUser) {
  const db = getDb();
  const owner = user.memberships.find((m) => m.role === "owner" && m.accountKind === "business");
  if (!owner) return { user: { email: user.email }, account: null, preregIco: await preregIcoOf(user.email) };
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
        verifiedAt: schema.certificates.verifiedAt,
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
    accountants: await linkedAccountants(account.id),
    closure: account.closedAt ? await closureState(account.id, account.closedAt) : null,
  };
}

/**
 * Odkud účet přišel (R17.4, K9): z předregistrace se stejným e-mailem (bez ohledu na velikost písmen) převezme
 * utm_source/medium/campaign, datum předregistrace a zda přišla přes doporučení. Bez předregistrace null.
 */
async function acquisitionOf(email: string): Promise<(typeof schema.accounts.$inferInsert)["acquisition"]> {
  const [p] = await getDb()
    .select({ utm: schema.preregistrations.utm, createdAt: schema.preregistrations.createdAt, referredBy: schema.preregistrations.referredBy })
    .from(schema.preregistrations)
    .where(sql`lower(${schema.preregistrations.email}) = lower(${email})`)
    .orderBy(asc(schema.preregistrations.createdAt))
    .limit(1);
  if (!p) return null;
  return {
    utm_source: p.utm?.utm_source ?? null,
    utm_medium: p.utm?.utm_medium ?? null,
    utm_campaign: p.utm?.utm_campaign ?? null,
    preregistered_at: p.createdAt.toISOString(),
    referred: !!p.referredBy,
  };
}

/** IČO z předregistrace se stejným e-mailem (bez ohledu na velikost písmen) – krok „Firma“ ho doplní (R17.3). */
async function preregIcoOf(email: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ ico: schema.preregistrations.ico })
    .from(schema.preregistrations)
    .where(and(sql`lower(${schema.preregistrations.email}) = lower(${email})`, sql`${schema.preregistrations.ico} is not null`))
    .orderBy(desc(schema.preregistrations.createdAt))
    .limit(1);
  return row?.ico ?? null;
}

/** Stav zrušeného účtu pro nastavení (Б7, R6.4): kdy nejpozději smažeme data a co ještě čeká. */
async function closureState(accountId: string, closedAt: Date) {
  const unsent = await unsentProductionOf(accountId);
  const [pg] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.sales)
    .where(and(eq(schema.sales.accountId, accountId), eq(schema.sales.mode, "playground"), inArray(schema.sales.status, ["queued", "sending", "failed", "rejected"])));
  const held = unsent.sales.length + unsent.quarantine.length > 0;
  const view = unsentView(unsent);
  return {
    held,
    deleteBy: closedDeleteBy(closedAt, held).toISOString(),
    devicesOffAt: new Date(closedAt.getTime() + RETENTION.closedDeviceDays * 86_400_000).toISOString(),
    unsentProduction: unsent.sales.length,
    quarantineProduction: unsent.quarantine.length,
    /** co vlastník vidí a „Evidováno jinak“ pak potvrdí – přesně tato id (R7.12); u dlouhého seznamu null a platí unsentSeen (R8.7 N16) */
    unsentIds: view.ids,
    /** prvních 20 tržeb pro zobrazení */
    unsentSales: view.sales,
    unsentSeen: view.seen,
    unsentPlayground: pg?.n ?? 0,
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
  /** souhlas s obchodními podmínkami – povinný při založení účtu (R2.5) */
  acceptTerms: z.boolean().optional(),
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
    // EIČ = CN pokladního certifikátu (produkce v1.1, 3.1.2): jiné EIČ by FS odmítla a tržba by uvízla (R5.6)
    const certs = await db
      .select({ eic: schema.certificates.eic, environment: schema.certificates.environment })
      .from(schema.certificates)
      .where(and(eq(schema.certificates.accountId, owner.accountId), isNull(schema.certificates.revokedAt)));
    const clash = certs.find((c) => c.eic && c.eic !== values.eic);
    if (clash) {
      throw new HttpError(
        400,
        `EIČ ${values.eic ?? "(prázdné)"} neodpovídá pokladnímu certifikátu (${clash.eic}). EIČ musí být stejné jako v certifikátu – opravte ho, nebo nejdřív certifikát odstraňte.`,
      );
    }
    const before = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, owner.accountId), columns: { eic: true, dic: true } });
    await db.update(schema.accounts).set(values).where(eq(schema.accounts.id, owner.accountId));
    // Opravené EIČ uvolní tržby zablokované kvůli údajům účtu. Už odeslané tržby si drží svůj snímek (Р4).
    if ((before?.eic ?? before?.dic) !== (values.eic ?? values.dic)) {
      await requeueBlocked(owner.accountId, ACCOUNT_BLOCKS);
    }
    return owner.accountId;
  }
  if (input.acceptTerms !== true) throw new HttpError(400, "Pro založení účtu je potřeba souhlasit s obchodními podmínkami.");
  const acquisition = await acquisitionOf(user.email);
  return db.transaction(async (tx) => {
    await tx.update(schema.users).set({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() }).where(eq(schema.users.id, user.id));
    // zdroj návštěvy jen jednou, při založení (R17.4); úprava údajů účtu ho nemění
    const [acc] = await tx.insert(schema.accounts).values({ ...values, kind: "business", acquisition }).returning({ id: schema.accounts.id });
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
  if (account.closedAt) throw new HttpError(400, "Účet je zrušený.");
  if (account.eetMode !== mode && !opts.confirm) {
    // Přepnutí nemění režim už prodaných tržeb (Р3) – ale vlastník o nich musí vědět.
    const pending = (await unsettledByMode(accountId)).filter((p) => p.count > 0);
    if (pending.length) {
      throw new HttpError(409, "Některé tržby ještě nejsou vyřízené. Odešlou se v režimu, ve kterém vznikly. Potvrďte přepnutí.", { pending });
    }
  }
  if (mode === "production" && account.eetMode !== "production" && Date.now() < productionAcceptsFrom()) {
    // každá ostrá tržba by skončila v karanténě PRODUCTION_NOT_OPEN, kde zbývá jen ruční vyřízení (R6.11)
    const from = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague" }).format(productionAcceptsFrom());
    throw new HttpError(400, `Ostré prostředí Finanční správy přijímá tržby až od ${from} (přechodný režim). Ostrý provoz zapněte nejdřív v ten den; do té doby můžete zkoušet v Playgroundu.`);
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
      orderBy: desc(schema.certificates.createdAt),
    });
    if (!cert) throw new HttpError(400, mode === "production" ? "Nahrajte platný pokladní certifikát z DIS+." : "Nahrajte testovací certifikát pro Playground.");
    // ostrý provoz až po úspěšném ověřovacím odeslání s tímto certifikátem (R1.9)
    if (mode === "production" && !cert.verifiedAt) throw new HttpError(400, "Nejdřív ověřte spojení s Finanční správou (tlačítko „Ověřit“) s ostrým certifikátem.");
    const units = await db.select().from(schema.evidenceUnits).where(and(eq(schema.evidenceUnits.accountId, accountId), eq(schema.evidenceUnits.active, true)));
    if (!units.length) throw new HttpError(400, "Přidejte alespoň jednu evidenční jednotku.");
    if (units.some((u) => !u.fsUnitId)) throw new HttpError(400, "Všechny evidenční jednotky musí mít číslo přidělené Finanční správou.");
  }
  if (account.eetMode === mode) return;
  // okamžik přepnutí: tržba v jiném režimu prodaná po něm jde do karantény MODE_MISMATCH (R5.1)
  await db.update(schema.accounts).set({ eetMode: mode, eetModeChangedAt: new Date() }).where(eq(schema.accounts.id, accountId));
}

/** Registrace zařízení — token se vrací jen jednou, v DB je jen jeho hash. */
export async function registerDevice(accountId: string, input: { name: string; registerId: string; unitId: string | null }) {
  const db = getDb();
  const account = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) }))!;
  if (account.closedAt) throw new HttpError(400, "Účet je zrušený.");
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
  // bezpečnostní upozornění: nová pokladna může prodávat a nahrávat tržby jménem účtu (B Дрібне 2)
  await notifyOwners(accountId, `device-registered:${deviceId}:${Date.now()}`, `Nová pokladna ${input.registerId} v EvidujZdarma`, `K vašemu účtu bylo právě zaregistrováno zařízení „${input.name}“ jako pokladna ${input.registerId}. Pokud jste to nebyli vy, odpojte ho v nastavení pokladny (Zařízení) a změňte PIN vlastníka.`, "/pokladna/nastaveni");
  return { deviceId, token };
}

/** E-mail vlastníkům účtu (bezpečnostní upozornění; transakční, ne marketing). */
export async function notifyOwners(accountId: string, dedupeKey: string, subject: string, text: string, path: string) {
  const [{ enqueueEmail }, { ownerEmails }, { absoluteUrl }] = await Promise.all([import("./mail"), import("./owners"), import("@/lib/site")]);
  for (const to of await ownerEmails(accountId)) {
    await enqueueEmail({ to, template: "notice", dedupeKey: `${dedupeKey}:${to}`, payload: { subject, text, url: absoluteUrl(path), buttonLabel: "Otevřít nastavení" } });
  }
}

/**
 * Zapne / vypne evidenční jednotku. Zapnutí počítá limit plánu stejně jako založení nové (B Дрібне 6).
 */
export async function setUnitActive(accountId: string, unitId: string, active: boolean) {
  const db = getDb();
  if (active) {
    const account = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) }))!;
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.evidenceUnits)
      .where(and(eq(schema.evidenceUnits.accountId, accountId), eq(schema.evidenceUnits.active, true), ne(schema.evidenceUnits.id, unitId)));
    const limit = limitsFor(account.plan).units;
    if (n >= limit) throw new HttpError(400, `Zdarma můžete mít ${limit} evidenční jednotky. Více v Premium.`);
  }
  const [unit] = await db
    .update(schema.evidenceUnits)
    .set({ active, changedAt: new Date() })
    .where(and(eq(schema.evidenceUnits.id, unitId), eq(schema.evidenceUnits.accountId, accountId)))
    .returning();
  if (!unit) throw new HttpError(404, "Jednotka nenalezena");
  return unit;
}
