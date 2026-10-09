import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb, schema } from "@ez/db";
import { getCurrentUser, type CurrentUser } from "./auth";
import { clientIpFromHeaders, rateLimit } from "./rate-limit";

/**
 * Adminský kabinet /admin (R15.2) – jen pro provozovatele. Přístup: běžné přihlášení (magic link) a e-mail
 * v ADMIN_EMAILS (env, oddělené čárkou). Kdo tam není, dostane 404 – kabinet se neprozradí. Zobrazení stránek
 * s osobními údaji se zapisují do auditu (admin_audit).
 */

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Přihlášený správce, nebo null (stránka pak volá notFound(), API vrací 404). Limit požadavků na IP. */
export async function currentAdmin(): Promise<CurrentUser | null> {
  const allowed = adminEmails();
  if (!allowed.size) return null;
  const ip = clientIpFromHeaders(await headers());
  if (!rateLimit(`admin:${ip}`, 120, 60)) return null;
  const user = await getCurrentUser();
  if (!user || !allowed.has(user.email.toLowerCase())) return null;
  return user;
}

/** Záznam do auditu: kdo, kdy, která stránka s osobními údaji. */
export async function auditView(user: CurrentUser, page: string): Promise<void> {
  await getDb().insert(schema.adminAudit).values({ userId: user.id, email: user.email, page: page.slice(0, 200) });
}

/** „Interní“ adresa – naše testovací (@swipescape.eu) a adresy s „+“; do čísel v záhlaví se nepočítají. */
export function isInternalEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const [local = "", domain = ""] = e.split("@");
  return domain === "swipescape.eu" || local.includes("+");
}

export const PREREG_STATUSES = [
  { value: "new", label: "новий" },
  { value: "contacted", label: "зв'язались" },
  { value: "registered", label: "зареєструвався" },
  { value: "not_interested", label: "не цікаво" },
] as const;
export type PreregStatus = (typeof PREREG_STATUSES)[number]["value"];
export const isPreregStatus = (v: unknown): v is PreregStatus => PREREG_STATUSES.some((s) => s.value === v);
export const statusLabel = (v: string) => PREREG_STATUSES.find((s) => s.value === v)?.label ?? v;

export interface AdminPrereg {
  id: string;
  createdAt: Date;
  email: string;
  ico: string | null;
  companyName: string | null;
  industry: string | null;
  establishmentsCount: number | null;
  needs: string[];
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
  source: string | null;
  crmStatus: string;
  crmNote: string | null;
  internal: boolean;
}

/** Zdroj z UTM (utm_source / medium / campaign); odkazující stránku k předregistraci neukládáme. */
function sourceOf(utm: Record<string, string> | null): string | null {
  if (!utm) return null;
  const parts = [utm.utm_source, utm.utm_medium, utm.utm_campaign].filter(Boolean);
  return parts.length ? parts.join(" / ") : null;
}

/** Předregistrace pro tabulku (bez dokladů o odvolaném souhlasu a blokací – ty nejsou zájemci). */
export async function listPreregistrations(): Promise<AdminPrereg[]> {
  const p = schema.preregistrations;
  const rows = await getDb()
    .select()
    .from(p)
    .where(sql`${p.confirmTokenIssuedAt} is not null`)
    .orderBy(desc(p.createdAt));
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    email: r.email,
    ico: r.ico,
    companyName: r.companyName,
    industry: r.industry,
    establishmentsCount: r.establishmentsCount,
    needs: r.needs,
    confirmedAt: r.confirmedAt,
    unsubscribedAt: r.unsubscribedAt,
    source: sourceOf(r.utm),
    crmStatus: r.crmStatus,
    crmNote: r.crmNote,
    internal: isInternalEmail(r.email),
  }));
}

export async function updatePreregCrm(id: string, input: { status: PreregStatus; note: string | null }): Promise<boolean> {
  const rows = await getDb()
    .update(schema.preregistrations)
    .set({ crmStatus: input.status, crmNote: input.note })
    .where(eq(schema.preregistrations.id, id))
    .returning({ id: schema.preregistrations.id });
  return rows.length > 0;
}

export interface AdminAccount {
  id: string;
  createdAt: Date;
  name: string;
  ico: string | null;
  mode: string;
  hasCertificate: boolean;
  units: number;
  firstProductionSale: Date | null;
}

/** Účty pokladny (bez účetních kanceláří a zrušených): režim, aktivní certifikát, jednotky, první ostrá tržba. */
export async function listAccounts(): Promise<AdminAccount[]> {
  const a = schema.accounts;
  const rows = await getDb()
    .select({
      id: a.id,
      createdAt: a.createdAt,
      name: a.name,
      ico: a.ico,
      mode: a.eetMode,
      hasCertificate: sql<boolean>`exists (select 1 from ${schema.certificates} c where c.account_id = ${a.id} and c.revoked_at is null)`,
      units: sql<number>`(select count(*)::int from ${schema.evidenceUnits} u where u.account_id = ${a.id})`,
      firstProductionSale: sql<Date | null>`(select min(s.sold_at) from ${schema.sales} s where s.account_id = ${a.id} and s.mode = 'production')`,
    })
    .from(a)
    .where(sql`${a.kind} = 'business' and ${a.closedAt} is null`)
    .orderBy(desc(a.createdAt));
  return rows.map((r) => ({ ...r, firstProductionSale: r.firstProductionSale ? new Date(r.firstProductionSale) : null }));
}

/** Buňka CSV: uvozovky, a vzorec (= + - @ na začátku) se zneškodní apostrofem – tabulkový procesor ho nespustí. */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(" ") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function preregCsv(rows: AdminPrereg[]): string {
  const head = ["created_at", "email", "ico", "company_name", "industry", "establishments", "needs", "confirmed_at", "unsubscribed_at", "source", "crm_status", "crm_note", "internal"];
  const lines = rows.map((r) =>
    [r.createdAt, r.email, r.ico, r.companyName, r.industry, r.establishmentsCount, r.needs, r.confirmedAt, r.unsubscribedAt, r.source, r.crmStatus, r.crmNote, r.internal ? "1" : "0"].map(cell).join(";"),
  );
  return `${head.join(";")}\n${lines.join("\n")}\n`;
}
