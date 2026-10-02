/**
 * Alert provozovateli přímo z workeru, když opakovaně selhává cron (R1.14).
 * Nejde přes web aplikaci – ta může být právě to, co nefunguje. Posílá se jen provozovateli
 * (ALERT_EMAIL), nikdy zákazníkům.
 */
const FAILURES_BEFORE_ALERT = 5;
const REPEAT_MS = 60 * 60_000;

type Transporter = { sendMail(msg: Record<string, unknown>): Promise<unknown> };
let transporter: Transporter | null | undefined;

async function getTransporter(): Promise<Transporter | null> {
  if (transporter !== undefined) return transporter;
  if (!process.env.SMTP_URL || !process.env.ALERT_EMAIL) return (transporter = null);
  const nodemailer = await import("nodemailer");
  return (transporter = nodemailer.createTransport(process.env.SMTP_URL) as Transporter);
}

async function send(subject: string, text: string, log: (m: string, e?: unknown) => void) {
  const t = await getTransporter();
  if (!t) {
    log(`ALERT (bez SMTP_URL/ALERT_EMAIL se neodešle): ${subject}`);
    return;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM ?? "EvidujZdarma <ahoj@evidujzdarma.cz>", to: process.env.ALERT_EMAIL, subject, text });
  } catch (e) {
    log("alert se nepodařilo odeslat", e instanceof Error ? e.name : e);
  }
}

/** Sleduje po sobě jdoucí selhání cronu a hlásí začátek výpadku, jeho trvání (1× za hodinu) a obnovení. */
export class CronHealth {
  private failures = 0;
  private firstFailureAt: Date | null = null;
  private alertedAt: number | null = null;

  constructor(private readonly log: (m: string, e?: unknown) => void) {}

  async failed(error: string, now = new Date()) {
    this.failures++;
    this.firstFailureAt ??= now;
    if (this.failures < FAILURES_BEFORE_ALERT) return;
    if (this.alertedAt !== null && now.getTime() - this.alertedAt < REPEAT_MS) return;
    this.alertedAt = now.getTime();
    await send(
      `⚠️ EvidujZdarma: cron selhává (${this.failures}× po sobě)`,
      `Plánované úlohy (odesílání tržeb do EET, e-maily) selhávají od ${this.firstFailureAt.toISOString()}.\nPoslední chyba: ${error.slice(0, 500)}\n\nTržby zůstávají ve frontě, ale lhůta 48 h běží. Zkontrolujte kontejner web a databázi.`,
      this.log,
    );
  }

  async succeeded(now = new Date()) {
    if (this.alertedAt !== null) {
      await send("✅ EvidujZdarma: cron znovu funguje", `Plánované úlohy běží od ${now.toISOString()} (výpadek od ${this.firstFailureAt?.toISOString()}, ${this.failures} selhání).`, this.log);
    }
    this.failures = 0;
    this.firstFailureAt = null;
    this.alertedAt = null;
  }
}
