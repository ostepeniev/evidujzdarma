import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";
import { renderEmail, type EmailTemplate } from "@/lib/emails";
import { isClosed } from "@/lib/launch";
import { safeError } from "./log";
import { NOT_CONSENT_PROOF } from "./prereg-proof";

/**
 * Obchodní sdělení – odejde jen s potvrzeným e-mailem (DOI), souhlasem a bez odhlášení v okamžiku odeslání (Р5).
 * E-maily k webináři a Účetnímu kabinetu (termín, zpráva o spuštění) sem nepatří: jsou to odpovědi na žádost
 * z předregistrace a stránka odhlášení po „Odhlásit jen novinky“ slibuje, že přijdou dál (varianta B, R9.7, R10.4).
 */
export const MARKETING_TEMPLATES: ReadonlySet<EmailTemplate> = new Set<EmailTemplate>(["dis-launch"]);
/** E-maily k čekací listině (včasný přístup) – jen potvrzeným a neodhlášeným adresám. */
const WAITLIST_TEMPLATES: ReadonlySet<EmailTemplate> = new Set<EmailTemplate>(["app-ready"]);

/** Pokladna ještě není otevřená: e-mail se neodešle ani nezruší, jen se odloží (R7.6). */
const NOT_LAUNCHED = "NOT_LAUNCHED";
const NOT_LAUNCHED_RETRY_MS = 24 * 3_600_000;

/** Smí se e-mail odeslat právě teď? null = ano, jinak důvod. Kontroluje se při odeslání, ne při zařazení. */
async function blockedReason(template: EmailTemplate, to: string): Promise<string | null> {
  if (!MARKETING_TEMPLATES.has(template) && !WAITLIST_TEMPLATES.has(template)) return null;
  // „Pokladna je připravena“ jen po skutečném otevření pokladny – jinak by odkaz vedl na heslo (R7.6)
  if (template === "app-ready" && isClosed("/pokladna")) return NOT_LAUNCHED;
  // doklad o odvolaném souhlasu není předregistrace – adresa s ním je pro e-maily neznámá (R9.3)
  const p = await getDb().query.preregistrations.findFirst({ where: and(sql`lower(${schema.preregistrations.email}) = lower(${to})`, NOT_CONSENT_PROOF) });
  if (!p?.confirmedAt) return "UNCONFIRMED";
  if (p.unsubscribedAt) return "UNSUBSCRIBED";
  if (MARKETING_TEMPLATES.has(template) && !p.marketingConsent) return "NO_CONSENT";
  return null;
}

/**
 * E-maily jdou přes outbox v Postgresu: zápis je součástí stejné operace jako registrace,
 * odeslání proběhne hned po odpovědi (after) a případné chyby dořeší worker.
 */
export async function enqueueEmail(opts: {
  to: string;
  template: EmailTemplate;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  sendAfter?: Date;
}): Promise<boolean> {
  const db = getDb();
  // true = e-mail je nově ve frontě; false = stejný dedupeKey už tam je
  const rows = await db
    .insert(schema.emailOutbox)
    .values({
      to: opts.to,
      template: opts.template,
      payload: opts.payload,
      dedupeKey: opts.dedupeKey === undefined ? undefined : fitDedupeKey(opts.dedupeKey),
      sendAfter: opts.sendAfter ?? new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: schema.emailOutbox.id });
  return rows.length > 0;
}

/** Délka sloupce email_outbox.dedupe_key. */
const DEDUPE_KEY_MAX = 128;

/**
 * Klíč delší než sloupec (dlouhá e-mailová adresa v klíči) se deterministicky zkrátí – začátek + otisk celého klíče –
 * místo chyby „value too long“, která by e-mail (a s ním třeba příjem tržby) shodila (R8.7). Stejný vstup = stejný klíč.
 */
export function fitDedupeKey(key: string): string {
  if (key.length <= DEDUPE_KEY_MAX) return key;
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 40);
  return `${key.slice(0, DEDUPE_KEY_MAX - hash.length - 1)}#${hash}`;
}

type Transporter = { sendMail(msg: Record<string, unknown>): Promise<unknown> };
let transporter: Transporter | null | undefined;

async function getTransporter(): Promise<Transporter | null> {
  if (transporter !== undefined) return transporter;
  const url = process.env.SMTP_URL;
  if (!url) {
    transporter = null;
    return null;
  }
  const nodemailer = await import("nodemailer");
  // pomalý SMTP: spojení i nečinnost končí dřív, než jiný běh vrátí e-mail ze „sending“ do fronty (OUTBOX_STALE_MS) – jinak dvojí odeslání (Д3-10)
  transporter = nodemailer.createTransport({ url, connectionTimeout: 60_000, greetingTimeout: 30_000, socketTimeout: 60_000 }) as unknown as Transporter;
  return transporter;
}

/**
 * Payload bez jednorázových tajemství – po odeslání (nebo zrušení) je fronta už nepotřebuje a v DB ani v záloze
 * nesmí zůstat použitelný odkaz: potvrzení předregistrace (DOI), přihlašovací odkaz (Д3-5).
 */
function withoutSecrets(template: string, payload: unknown): Record<string, unknown> {
  const p = { ...((payload ?? {}) as Record<string, unknown>) };
  if (template === "prereg-confirm" || template === "interest-confirm") delete p.confirmToken;
  if (template === "login-link") delete p.url;
  // notice s odkazem nesoucím token (potvrzení námitky) – token z adresy pryč (R7.5)
  if (template === "notice" && typeof p.url === "string" && /[?&]token=/.test(p.url)) p.url = withoutTokenParam(p.url);
  return p;
}

function withoutTokenParam(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("token");
    return u.toString();
  } catch {
    return url.replace(/([?&])token=[^&#]*/g, "$1");
  }
}

/** Jak dlouho smí e-mail zůstat ve stavu „sending“, než ho jiný běh vrátí do fronty. */
const OUTBOX_STALE_MS = 10 * 60_000;

/** Odešle čekající e-maily (max `limit`). Bezpečné pro souběh: řádky zamyká přes UPDATE … RETURNING. */
export async function processOutbox(limit = 20): Promise<{ sent: number; failed: number }> {
  if (!hasDatabase()) return { sent: 0, failed: 0 };
  const tx = await getTransporter();
  const db = getDb();
  // e-maily, které zůstaly ve stavu „sending“ po pádu procesu, se vrátí do fronty (B Дрібне 18);
  // řádek bez claimed_at je z doby před sloupcem – zaseknutý určitě
  await db
    .update(schema.emailOutbox)
    .set({ status: "queued", claimedAt: null })
    .where(and(eq(schema.emailOutbox.status, "sending"), or(isNull(schema.emailOutbox.claimedAt), lt(schema.emailOutbox.claimedAt, new Date(Date.now() - OUTBOX_STALE_MS)))));
  const claimed = await db
    .update(schema.emailOutbox)
    .set({ status: "sending", claimedAt: new Date(), attempts: sql`${schema.emailOutbox.attempts} + 1` })
    .where(
      inArray(
        schema.emailOutbox.id,
        db
          .select({ id: schema.emailOutbox.id })
          .from(schema.emailOutbox)
          .where(and(eq(schema.emailOutbox.status, "queued"), lte(schema.emailOutbox.sendAfter, new Date())))
          .orderBy(schema.emailOutbox.sendAfter)
          .limit(limit)
          .for("update", { skipLocked: true }),
      ),
    )
    .returning();

  let sent = 0;
  let failed = 0;
  for (const row of claimed) {
    try {
      const blocked = await blockedReason(row.template as EmailTemplate, row.to);
      if (blocked === NOT_LAUNCHED) {
        await db
          .update(schema.emailOutbox)
          .set({ status: "queued", claimedAt: null, attempts: row.attempts - 1, lastError: blocked, sendAfter: new Date(Date.now() + NOT_LAUNCHED_RETRY_MS) })
          .where(eq(schema.emailOutbox.id, row.id));
        continue;
      }
      if (blocked) {
        await db.update(schema.emailOutbox).set({ status: "cancelled", lastError: blocked, payload: withoutSecrets(row.template, row.payload) }).where(eq(schema.emailOutbox.id, row.id));
        continue;
      }
      const mail = renderEmail(row.template as EmailTemplate, row.payload);
      if (tx) {
        await tx.sendMail({
          from: process.env.MAIL_FROM ?? "EvidujZdarma <ahoj@evidujzdarma.cz>",
          to: row.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          headers: mail.unsubscribeUrl
            ? { "List-Unsubscribe": `<${mail.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
            : undefined,
        });
      } else if (process.env.NODE_ENV === "production") {
        // produkce bez SMTP: e-mail se neoznačí jako odeslaný a obsah (odkazy s tokeny) se nezaloguje (R3.6)
        throw new Error("SMTP_URL není nastaven");
      } else {
        console.info(`[mail:dev] → ${row.to}: ${mail.subject}\n${mail.text}`);
      }
      await db.update(schema.emailOutbox).set({ status: "sent", sentAt: new Date(), lastError: null, payload: withoutSecrets(row.template, row.payload) }).where(eq(schema.emailOutbox.id, row.id));
      sent++;
    } catch (e) {
      failed++;
      const retry = row.attempts < 5;
      await db
        .update(schema.emailOutbox)
        .set({
          status: retry ? "queued" : "failed",
          ...(retry ? {} : { payload: withoutSecrets(row.template, row.payload) }),
          lastError: safeError(e).message,
          sendAfter: new Date(Date.now() + 2 ** row.attempts * 60_000),
        })
        .where(eq(schema.emailOutbox.id, row.id));
    }
  }
  return { sent, failed };
}
