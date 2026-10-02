import "server-only";
import { cookies } from "next/headers";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { safeError } from "./log";
import { randomToken, sha256 } from "./tokens";

export const SESSION_COOKIE = "ez_session";
const SESSION_DAYS = 30;
const LOGIN_TOKEN_MINUTES = 15;

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  memberships: { accountId: string; role: "owner" | "cashier" | "accountant"; accountName: string; accountKind: string }[];
}

export async function createLoginToken(email: string, redirectTo?: string): Promise<string> {
  const token = randomToken(32);
  await getDb()
    .insert(schema.loginTokens)
    .values({
      tokenHash: sha256(token),
      email: email.toLowerCase(),
      redirectTo: redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : null,
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60_000),
    });
  return token;
}

/** Spotřebuje jednorázový odkaz, založí uživatele (pokud neexistuje) a session. */
export async function consumeLoginToken(token: string, userAgent: string | null): Promise<{ sessionToken: string; redirectTo: string | null } | null> {
  const db = getDb();
  const [row] = await db
    .update(schema.loginTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.loginTokens.tokenHash, sha256(token)), isNull(schema.loginTokens.usedAt), gt(schema.loginTokens.expiresAt, new Date())))
    .returning();
  if (!row) return null;

  let user = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${row.email}` });
  if (!user) {
    [user] = await db.insert(schema.users).values({ email: row.email, emailVerifiedAt: new Date() }).returning();
  } else if (!user.emailVerifiedAt) {
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, user.id));
  }
  const sessionToken = randomToken(32);
  await db.insert(schema.sessions).values({
    tokenHash: sha256(sessionToken),
    userId: user!.id,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
    userAgent: userAgent?.slice(0, 300) ?? null,
  });
  return { sessionToken, redirectTo: row.redirectTo };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const session = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date())),
  });
  if (!session) return null;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
  if (!user) return null;
  const rows = await db
    .select({ accountId: schema.memberships.accountId, role: schema.memberships.role, accountName: schema.accounts.name, accountKind: schema.accounts.kind })
    .from(schema.memberships)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.memberships.accountId))
    .where(eq(schema.memberships.userId, user.id));
  return { id: user.id, email: user.email, name: user.name, memberships: rows };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** doplňující strukturovaná data pro klienta (např. seznam blokujících tržeb) */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Vrátí účet, kde je přihlášený uživatel vlastníkem (první, pokud jich má víc). */
export async function requireOwnerAccount(accountId?: string): Promise<{ user: CurrentUser; accountId: string }> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Nejste přihlášeni");
  const m = user.memberships.find((x) => x.role === "owner" && x.accountKind === "business" && (!accountId || x.accountId === accountId));
  if (!m) throw new HttpError(403, "Nemáte přístup k tomuto účtu");
  return { user, accountId: m.accountId };
}

export interface DeviceContext {
  device: typeof schema.devices.$inferSelect;
  account: typeof schema.accounts.$inferSelect;
}

/** Autentizace pokladny tokenem zařízení (Authorization: Bearer …). */
export async function authenticateDevice(req: Request): Promise<DeviceContext> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token.length < 30) throw new HttpError(401, "Chybí token zařízení");
  const db = getDb();
  const device = await db.query.devices.findFirst({ where: and(eq(schema.devices.tokenHash, sha256(token)), isNull(schema.devices.revokedAt)) });
  if (!device) throw new HttpError(401, "Zařízení není registrované nebo bylo odpojeno");
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, device.accountId) });
  if (!account) throw new HttpError(401, "Účet neexistuje");
  // lastSeen aktualizujeme nejvýše jednou za minutu
  if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > 60_000) {
    await db.update(schema.devices).set({ lastSeenAt: new Date() }).where(eq(schema.devices.id, device.id));
  }
  return { device, account };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message, ...(e.details ?? {}) }, { status: e.status });
  // do logu jen typ a kód chyby – nikdy SQL parametry, tokeny ani obsah požadavku (R3.6)
  console.error("[api] chyba", safeError(e));
  return Response.json({ error: "Interní chyba serveru" }, { status: 500 });
}
