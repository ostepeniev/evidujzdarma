import "server-only";
import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { verifyPin } from "@/lib/pos/pin";
import { HttpError, type DeviceContext } from "./auth";
import { safeEqual } from "./tokens";

/**
 * PIN vlastníka se ověřuje jen na serveru (R3.10): jeho otisk do pokladny nejde, takže ho nelze
 * offline uhodnout hrubou silou. Po chybách roste prodleva. Úspěšné ověření vrací krátkodobé
 * schválení podepsané serverem – jen s ním se přijme vratka.
 */
export function validatePinForRole(role: string, pin: string): void {
  if (role === "owner" ? !/^\d{6,8}$/.test(pin) : !/^\d{4,8}$/.test(pin)) {
    throw new HttpError(400, role === "owner" ? "PIN vlastníka musí mít 6–8 číslic." : "PIN musí mít 4–8 číslic.");
  }
}

const FREE_ATTEMPTS = 2;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60 * 60_000;
const attempts = new Map<string, { failures: number; lockedUntil: number }>();

/** Jen pro testy. */
export function resetPinAttempts(): void {
  attempts.clear();
}

const APPROVAL_TTL_MS = 15 * 60_000;
type Approval = { sid: string; aid: string; did: string; p: "refund" | "unlock"; iat: number };

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("APP_SECRET není nastaven");
  return s;
}

function sign(payload: Approval): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/** Ověří schválení vratky: podpis, účet, zařízení a čas vůči okamžiku prodeje. Vrátí id vlastníka. */
export function verifyApproval(token: string | null | undefined, o: { accountId: string; deviceId: string; soldAt: string }): string | null {
  if (!token || token.length > 1000) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  // porovnává se kanonický text MAC, ne dekódované bajty: base64url s jinými výplňovými bity
  // by se dekódoval na stejný podpis a token by šel pozměnit
  if (!safeEqual(mac, createHmac("sha256", secret()).update(body).digest("base64url"))) return null;
  let p: Approval;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Approval;
  } catch {
    return null;
  }
  if (p.p !== "refund" || p.aid !== o.accountId || p.did !== o.deviceId) return null;
  const sold = Date.parse(o.soldAt);
  // schválení vzniklo nejvýš 15 min před vratkou (a ne po ní, s tolerancí hodin 2 min)
  if (!(p.iat <= sold + 2 * 60_000 && sold - p.iat <= APPROVAL_TTL_MS)) return null;
  return p.sid;
}

export async function verifyStaffPinOnline(ctx: DeviceContext, staffId: string, pin: string, purpose: "refund" | "unlock"): Promise<{ approval: string | null }> {
  const key = `${ctx.device.id}:${staffId}`;
  const now = Date.now();
  const state = attempts.get(key) ?? { failures: 0, lockedUntil: 0 };
  if (state.lockedUntil > now) {
    throw new HttpError(429, "Příliš mnoho chybných pokusů. Zkuste to později.", { retryAfter: Math.ceil((state.lockedUntil - now) / 1000) });
  }
  const staff = await getDb().query.staff.findFirst({
    where: and(eq(schema.staff.id, staffId), eq(schema.staff.accountId, ctx.account.id), eq(schema.staff.active, true)),
  });
  const ok = !!staff?.pinHash && (await verifyPin(pin, staff.pinHash));
  if (!ok) {
    state.failures++;
    if (state.failures > FREE_ATTEMPTS) state.lockedUntil = now + Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (state.failures - FREE_ATTEMPTS - 1));
    attempts.set(key, state);
    throw new HttpError(401, "Nesprávný PIN.");
  }
  attempts.delete(key);
  if (purpose === "refund" && staff!.role !== "owner") throw new HttpError(403, "Vratku schvaluje vlastník.");
  return { approval: staff!.role === "owner" ? sign({ sid: staff!.id, aid: ctx.account.id, did: ctx.device.id, p: purpose, iat: now }) : null };
}
