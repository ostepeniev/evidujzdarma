import "server-only";
import { and, eq, isNull, like } from "drizzle-orm";
import { isNaturalPerson } from "@ez/cz";
import { getDb, schema } from "@ez/db";
import { absoluteUrl, SITE } from "@/lib/site";
import { enqueueEmail } from "./mail";
import { randomToken, sha256 } from "./tokens";

/**
 * Námitky ke katalogu (čl. 21 GDPR) – R3.5. U fyzických osob (OSVČ) se stránka vyřadí z indexace
 * hned (ochrana soukromí má přednost). U právnických osob až po potvrzení e-mailu: jinak by kdokoli
 * mohl formulářem vyřadit z vyhledávačů libovolnou firmu.
 */
export async function createObjection(input: { kind: "objection" | "correction"; ico: string | null; icp: string | null; name: string; email: string; message: string }) {
  const db = getDb();
  const token = randomToken(24);
  const [row] = await db
    .insert(schema.objections)
    .values({ ...input, confirmTokenHash: sha256(token) })
    .returning({ id: schema.objections.id });
  const firm = input.ico ? await db.query.firms.findFirst({ where: eq(schema.firms.ico, input.ico) }) : undefined;
  const natural = !!firm && (firm.isNaturalPerson || isNaturalPerson(firm.legalForm));
  if (firm && natural) await db.update(schema.firms).set({ noindex: true }).where(eq(schema.firms.ico, firm.ico));
  await enqueueEmail({
    to: input.email,
    template: "notice",
    dedupeKey: `objection-confirm:${row!.id}`,
    payload: {
      subject: "Potvrďte prosím svou žádost ke katalogu firem",
      text: natural
        ? "Vaši žádost jsme přijali a stránku jsme vyřadili z vyhledávačů. Potvrďte prosím, že žádost jste odeslali vy – vyřídíme ji nejpozději do 30 dnů."
        : "Vaši žádost jsme přijali. Potvrďte prosím, že jste ji odeslali vy – teprve pak stránku vyřadíme z vyhledávačů a žádost vyřídíme nejpozději do 30 dnů.",
      url: absoluteUrl(`/namitka/potvrzeni?token=${token}`),
      buttonLabel: "Potvrdit žádost",
    },
  });
  return { id: row!.id, deindexed: natural };
}

/** Potvrzení žádosti (jen POST). U právnické osoby teprve teď noindex. */
export async function confirmObjection(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return false;
  const db = getDb();
  const [row] = await db
    .update(schema.objections)
    .set({ confirmedAt: new Date(), confirmTokenHash: null })
    .where(and(eq(schema.objections.confirmTokenHash, sha256(token)), isNull(schema.objections.confirmedAt)))
    .returning();
  if (!row) return false;
  if (row.ico) await db.update(schema.firms).set({ noindex: true }).where(eq(schema.firms.ico, row.ico));
  return true;
}

/** Jeden přehled denně provozovateli (lhůta pro odpověď je 30 dnů) – místo e-mailu ke každé žádosti. */
export async function runObjectionDigest(now = new Date()): Promise<number> {
  const db = getDb();
  const day = now.toISOString().slice(0, 10);
  const sentToday = await db.select({ id: schema.emailOutbox.id }).from(schema.emailOutbox).where(like(schema.emailOutbox.dedupeKey, `objection-digest:${day}`)).limit(1);
  if (sentToday.length) return 0;
  const pending = await db.select().from(schema.objections).where(isNull(schema.objections.digestedAt)).orderBy(schema.objections.createdAt).limit(500);
  if (!pending.length) return 0;
  const lines = pending.map(
    (o) =>
      `• ${o.createdAt.toISOString().slice(0, 16).replace("T", " ")} · ${o.kind === "correction" ? "oprava" : "námitka"} · IČO ${o.ico ?? "—"} · IČP ${o.icp ?? "—"} · ${o.confirmedAt ? "potvrzeno" : "nepotvrzeno"} · ${o.name} <${o.email}>\n  ${o.message.slice(0, 500).replace(/\s+/g, " ")}`,
  );
  await enqueueEmail({
    to: SITE.email,
    template: "notice",
    dedupeKey: `objection-digest:${day}`,
    payload: {
      subject: `Námitky a opravy ke katalogu: ${pending.length} nových`,
      text: `Nové žádosti (odpovědět do 30 dnů od přijetí):\n\n${lines.join("\n\n")}`,
    },
  });
  for (const o of pending) await db.update(schema.objections).set({ digestedAt: now }).where(eq(schema.objections.id, o.id));
  return pending.length;
}
