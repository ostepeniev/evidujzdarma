import "server-only";
import { TERMS_VERSION } from "@/lib/legal";
import { and, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { HttpError, type CurrentUser } from "./auth";
import { absoluteUrl } from "@/lib/site";
import { enqueueEmail } from "./mail";
import { ownerEmails } from "./owners";
import { randomToken, sha256 } from "./tokens";

/** Účet účetní kanceláře přihlášeného uživatele (nebo null). */
export function accountantMembership(user: CurrentUser) {
  return user.memberships.find((m) => m.accountKind === "accountant" && (m.role === "owner" || m.role === "accountant")) ?? null;
}

export async function requireAccountant(user: CurrentUser | null): Promise<string> {
  if (!user) throw new HttpError(401, "Nejste přihlášeni");
  const m = accountantMembership(user);
  if (!m) throw new HttpError(403, "Nejdřív založte účetní kabinet");
  return m.accountId;
}

export async function createAccountantAccount(user: CurrentUser, input: { name: string; ico: string | null; acceptTerms?: boolean }): Promise<string> {
  const existing = accountantMembership(user);
  if (existing) return existing.accountId;
  if (input.acceptTerms !== true) throw new HttpError(400, "Pro založení kabinetu je potřeba souhlasit s obchodními podmínkami.");
  return getDb().transaction(async (tx) => {
    await tx.update(schema.users).set({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() }).where(eq(schema.users.id, user.id));
    const [acc] = await tx.insert(schema.accounts).values({ kind: "accountant", name: input.name, ico: input.ico, plan: "partner" }).returning({ id: schema.accounts.id });
    await tx.insert(schema.memberships).values({ accountId: acc!.id, userId: user.id, role: "owner" });
    return acc!.id;
  });
}

export interface ClientReadiness {
  disActivated: boolean;
  unitsAnnounced: boolean;
  certificate: boolean;
  firstSale: boolean;
  /** odkud stav pochází: z naší pokladny (automaticky) nebo ručně */
  source: "pokladna" | "manual";
}

export interface CabinetClient {
  id: string;
  ico: string;
  label: string | null;
  linked: boolean;
  invited: boolean;
  /** platnost poslední pozvánky; samotný odkaz je jen v odpovědi na jeho vytvoření (v DB je hash) */
  inviteExpiresAt: string | null;
  readiness: ClientReadiness;
  lastSaleAt: string | null;
  mode: string | null;
}

/** Klienti účetní a stav jejich připravenosti na EET. U propojených klientů se stav počítá z pokladny. */
export async function cabinetClients(accountantAccountId: string, _siteUrl?: string): Promise<CabinetClient[]> {
  const db = getDb();
  const rows = await db.select().from(schema.accountantClients).where(eq(schema.accountantClients.accountantAccountId, accountantAccountId)).orderBy(schema.accountantClients.createdAt);
  const linkedIds = rows.map((r) => r.clientAccountId).filter((x): x is string => !!x);

  const [units, certs, sales, accounts] = linkedIds.length
    ? await Promise.all([
        db
          .select({ accountId: schema.evidenceUnits.accountId, n: sql<number>`count(*)::int` })
          .from(schema.evidenceUnits)
          .where(and(inArray(schema.evidenceUnits.accountId, linkedIds), eq(schema.evidenceUnits.active, true), isNotNull(schema.evidenceUnits.fsUnitId)))
          .groupBy(schema.evidenceUnits.accountId),
        db
          .select({ accountId: schema.certificates.accountId })
          .from(schema.certificates)
          .where(
            and(
              inArray(schema.certificates.accountId, linkedIds),
              eq(schema.certificates.environment, "production"),
              isNull(schema.certificates.revokedAt),
              gt(schema.certificates.validTo, new Date()),
            ),
          ),
        db
          .select({ accountId: schema.sales.accountId, last: sql<Date>`max(${schema.sales.soldAt})` })
          .from(schema.sales)
          .where(and(inArray(schema.sales.accountId, linkedIds), eq(schema.sales.mode, "production"), eq(schema.sales.status, "confirmed")))
          .groupBy(schema.sales.accountId),
        db.select({ id: schema.accounts.id, mode: schema.accounts.eetMode }).from(schema.accounts).where(inArray(schema.accounts.id, linkedIds)),
      ])
    : [[], [], [], []];
  const unitsBy = new Map(units.map((u) => [u.accountId, u.n]));
  const certBy = new Set(certs.map((c) => c.accountId));
  const salesBy = new Map(sales.map((s) => [s.accountId, s.last]));
  const modeBy = new Map(accounts.map((a) => [a.id, a.mode]));

  return rows.map((r) => {
    const linked = !!r.clientAccountId;
    const m = r.manualStatus ?? {};
    const readiness: ClientReadiness = linked
      ? {
          // jednotka s číslem od FS = klient je přihlášený k evidenci v DIS+
          disActivated: (unitsBy.get(r.clientAccountId!) ?? 0) > 0 || !!m.disActivated,
          unitsAnnounced: (unitsBy.get(r.clientAccountId!) ?? 0) > 0,
          certificate: certBy.has(r.clientAccountId!),
          firstSale: salesBy.has(r.clientAccountId!),
          source: "pokladna",
        }
      : { disActivated: !!m.disActivated, unitsAnnounced: !!m.unitsAnnounced, certificate: !!m.certificate, firstSale: !!m.firstSale, source: "manual" };
    const last = linked ? salesBy.get(r.clientAccountId!) : undefined;
    return {
      id: r.id,
      ico: r.ico,
      label: r.label,
      linked,
      invited: !linked && !!r.inviteTokenHash && !!r.inviteExpiresAt && r.inviteExpiresAt > new Date(),
      inviteExpiresAt: !linked && r.inviteExpiresAt ? r.inviteExpiresAt.toISOString() : null,
      readiness,
      lastSaleAt: last ? new Date(last).toISOString() : null,
      mode: linked ? (modeBy.get(r.clientAccountId!) ?? null) : null,
    };
  });
}

export async function addClients(accountantAccountId: string, items: { ico: string; label: string | null }[]): Promise<number> {
  if (!items.length) return 0;
  const inserted = await getDb()
    .insert(schema.accountantClients)
    .values(items.map((i) => ({ accountantAccountId, ico: i.ico, label: i.label })))
    .onConflictDoNothing()
    .returning({ id: schema.accountantClients.id });
  return inserted.length;
}

/** Platnost pozvánky do pokladny. */
export const INVITE_TTL_DAYS = 14;

export async function createInvite(accountantAccountId: string, clientId: string): Promise<string> {
  const token = randomToken(24);
  const now = new Date();
  const [row] = await getDb()
    .update(schema.accountantClients)
    // v DB jen otisk tokenu – únik databáze neprozradí platné pozvánky (R3.4)
    .set({ inviteTokenHash: sha256(token), invitedAt: now, inviteExpiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000) })
    .where(and(eq(schema.accountantClients.id, clientId), eq(schema.accountantClients.accountantAccountId, accountantAccountId)))
    .returning({ id: schema.accountantClients.id });
  if (!row) throw new HttpError(404, "Klient nenalezen");
  return token;
}

/** Klient přijme pozvánku: propojí svůj účet s účetní (souhlas se sdílením stavu a exportu tržeb). */
export async function acceptInvite(user: CurrentUser, token: string): Promise<{ accountantName: string }> {
  const db = getDb();
  const owner = user.memberships.find((m) => m.role === "owner" && m.accountKind === "business");
  if (!owner) throw new HttpError(400, "Nejdřív si nastavte pokladnu (údaje o firmě), pak pozvánku otevřete znovu.");
  const invite = await validInvite(token);
  if (!invite) throw new HttpError(404, "Pozvánka je neplatná, vypršela nebo už byla použita.");
  // pozvánku přijme jen firma, pro kterou ji účetní vystavila (R3.4)
  const client = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, owner.accountId) });
  if (!client?.ico || client.ico !== invite.ico) {
    throw new HttpError(403, `Pozvánka je pro IČO ${invite.ico}, ale vaše firma má ${client?.ico ? `IČO ${client.ico}` : "IČO nevyplněné"}. Požádejte účetní o správnou pozvánku.`);
  }
  const accountant = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, invite.accountantAccountId) });
  await db.transaction(async (tx) => {
    await tx
      .update(schema.accountantClients)
      .set({ clientAccountId: owner.accountId, inviteTokenHash: null, inviteExpiresAt: null })
      .where(eq(schema.accountantClients.id, invite.id));
    await tx
      .update(schema.accounts)
      .set({ referredByAccountantId: invite.accountantAccountId })
      .where(and(eq(schema.accounts.id, owner.accountId), isNull(schema.accounts.referredByAccountantId)));
  });
  const accountantName = accountant?.name ?? "účetní";
  // klient se o novém přístupu dozví e-mailem – i kdyby pozvánku přijal někdo jiný z jeho účtu
  for (const to of await ownerEmails(owner.accountId)) {
    await enqueueEmail({
      to,
      template: "notice",
      dedupeKey: `accountant-link:${invite.id}:${to}`,
      payload: {
        subject: `Účetní ${accountantName} má nyní přístup k vaší pokladně`,
        text: `Váš účet v EvidujZdarma byl propojen s účetní ${accountantName}. Účetní vidí stav vaší připravenosti na EET a může si stáhnout export tržeb. Pokud jste propojení nepovolili, zrušte ho v nastavení pokladny.`,
        url: absoluteUrl("/pokladna/nastaveni#ucetni"),
        buttonLabel: "Zobrazit propojení",
      },
    });
  }
  return { accountantName };
}

async function validInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return (
    (await getDb().query.accountantClients.findFirst({
      where: and(eq(schema.accountantClients.inviteTokenHash, sha256(token)), gt(schema.accountantClients.inviteExpiresAt, new Date())),
    })) ?? null
  );
}

export async function inviteInfo(token: string): Promise<{ accountantName: string; ico: string } | null> {
  const db = getDb();
  const invite = await validInvite(token);
  if (!invite) return null;
  const accountant = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, invite.accountantAccountId) });
  return { accountantName: accountant?.name ?? "Vaše účetní", ico: invite.ico };
}

/** ID účtů klientů, kteří účetní propojení povolili. */
export async function linkedClientAccounts(accountantAccountId: string): Promise<{ accountId: string; ico: string; label: string | null }[]> {
  const rows = await getDb()
    .select({ accountId: schema.accountantClients.clientAccountId, ico: schema.accountantClients.ico, label: schema.accountantClients.label })
    .from(schema.accountantClients)
    .where(and(eq(schema.accountantClients.accountantAccountId, accountantAccountId), isNotNull(schema.accountantClients.clientAccountId)));
  return rows.map((r) => ({ accountId: r.accountId!, ico: r.ico, label: r.label }));
}
