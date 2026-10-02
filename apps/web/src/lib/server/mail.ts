import "server-only";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";
import { renderEmail, type EmailTemplate } from "@/lib/emails";

/** Obchodní sdělení – odejde jen s potvrzeným e-mailem (DOI), souhlasem a bez odhlášení v okamžiku odeslání (Р5). */
export const MARKETING_TEMPLATES: ReadonlySet<EmailTemplate> = new Set<EmailTemplate>(["dis-launch"]);
/** E-maily k čekací listině (včasný přístup) – jen potvrzeným a neodhlášeným adresám. */
const WAITLIST_TEMPLATES: ReadonlySet<EmailTemplate> = new Set<EmailTemplate>(["app-ready"]);

/** Smí se e-mail odeslat právě teď? null = ano, jinak důvod. Kontroluje se při odeslání, ne při zařazení. */
async function blockedReason(template: EmailTemplate, to: string): Promise<string | null> {
  if (!MARKETING_TEMPLATES.has(template) && !WAITLIST_TEMPLATES.has(template)) return null;
  const p = await getDb().query.preregistrations.findFirst({ where: sql`lower(${schema.preregistrations.email}) = lower(${to})` });
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
}): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.emailOutbox)
    .values({
      to: opts.to,
      template: opts.template,
      payload: opts.payload,
      dedupeKey: opts.dedupeKey,
      sendAfter: opts.sendAfter ?? new Date(),
    })
    .onConflictDoNothing();
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
  transporter = nodemailer.createTransport(url) as unknown as Transporter;
  return transporter;
}

/** Odešle čekající e-maily (max `limit`). Bezpečné pro souběh: řádky zamyká přes UPDATE … RETURNING. */
export async function processOutbox(limit = 20): Promise<{ sent: number; failed: number }> {
  if (!hasDatabase()) return { sent: 0, failed: 0 };
  const tx = await getTransporter();
  const db = getDb();
  const claimed = await db
    .update(schema.emailOutbox)
    .set({ status: "sending", attempts: sql`${schema.emailOutbox.attempts} + 1` })
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
      if (blocked) {
        await db.update(schema.emailOutbox).set({ status: "cancelled", lastError: blocked }).where(eq(schema.emailOutbox.id, row.id));
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
      } else {
        console.info(`[mail:dev] → ${row.to}: ${mail.subject}\n${mail.text}`);
      }
      await db.update(schema.emailOutbox).set({ status: "sent", sentAt: new Date(), lastError: null }).where(eq(schema.emailOutbox.id, row.id));
      sent++;
    } catch (e) {
      failed++;
      const retry = row.attempts < 5;
      await db
        .update(schema.emailOutbox)
        .set({
          status: retry ? "queued" : "failed",
          lastError: e instanceof Error ? e.message : String(e),
          sendAfter: new Date(Date.now() + 2 ** row.attempts * 60_000),
        })
        .where(eq(schema.emailOutbox.id, row.id));
    }
  }
  return { sent, failed };
}
