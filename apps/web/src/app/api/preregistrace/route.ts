import { after } from "next/server";
import { z } from "zod";
import { count, lt, sql } from "drizzle-orm";
import { isValidIco, normalizeIco } from "@ez/cz";
import { getDb, hasDatabase, schema } from "@ez/db";
import { INDUSTRY_SLUGS } from "@/content/industries";
import { DIS_OPENS, TIMELINE, timelineAt } from "@/content/facts";
import { enqueueEmail, processOutbox } from "@/lib/server/mail";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { randomToken, sha256, shortCode } from "@/lib/server/tokens";
import { lookupCompany } from "@/lib/server/ares";
import { assess } from "@/lib/eet-assessment";

const NEEDS = ["terminal", "printer", "dis_help"] as const;

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  ico: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizeIco(v) : null))
    .refine((v) => v === null || isValidIco(v), "Neplatné IČO"),
  industry: z.enum(INDUSTRY_SLUGS).optional(),
  establishments: z.coerce.number().int().min(1).max(99).optional(),
  needs: z.array(z.enum(NEEDS)).max(3).default([]),
  marketingConsent: z.boolean().default(false),
  ref: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{4,12}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  utm: z.record(z.string(), z.string().max(100)).optional(),
  /** honeypot — vyplní jen bot */
  website: z.string().max(0).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`prereg:${ip}`, 5, 600)) {
    return Response.json({ error: "Příliš mnoho pokusů, zkuste to prosím za chvíli." }, { status: 429 });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const issue = e instanceof z.ZodError ? e.issues[0] : undefined;
    const field = issue?.path[0];
    const msg =
      field === "email" ? "Zadejte platný e-mail." : field === "ico" ? "IČO není platné (8 číslic s kontrolní číslicí)." : "Zkontrolujte prosím formulář.";
    return Response.json({ error: msg, field }, { status: 400 });
  }
  if (body.website) return Response.json({ ok: true, position: null, referralCode: null }); // tichý honeypot

  if (!hasDatabase()) {
    return Response.json({ error: "Registrace je dočasně nedostupná." }, { status: 503 });
  }
  const db = getDb();

  // Název firmy doplníme z ARES (nepovinné, nesmí zablokovat registraci).
  let companyName: string | null = null;
  let plan: { date: string; text: string }[] | null = null;
  if (body.ico) {
    try {
      const found = await lookupCompany(body.ico);
      companyName = found?.subject.name ?? null;
      // Osobní EET plán podle IČO (provozovny z RŽP, EET OFF jen pro OSVČ…)
      if (found) {
        const a = assess(found.subject, found.rzp);
        const disOpens = timelineAt(DIS_OPENS);
        const fallback = new Date() < new Date(`${disOpens.date}T00:00:00+01:00`) ? `od ${disOpens.dateLabel}` : "co nejdříve";
        if (a.checklist.length) plan = a.checklist.map((c) => ({ date: c.date ?? fallback, text: `${c.title} – ${c.text}` }));
      }
    } catch {
      companyName = null;
    }
  }

  const referralCode = shortCode(8);
  const confirmToken = randomToken(24);
  const unsubscribeToken = randomToken(24);
  const now = new Date();

  const inserted = await db
    .insert(schema.preregistrations)
    .values({
      email: body.email,
      ico: body.ico,
      companyName,
      industry: body.industry,
      establishmentsCount: body.establishments,
      needs: body.needs,
      marketingConsent: body.marketingConsent,
      marketingConsentAt: body.marketingConsent ? now : null,
      consentEvidence: sha256(`${ip}|${req.headers.get("user-agent") ?? ""}|${now.toISOString()}`),
      referralCode,
      referredBy: body.ref ?? null,
      confirmToken,
      unsubscribeToken,
      utm: body.utm,
    })
    .onConflictDoNothing()
    .returning({ id: schema.preregistrations.id, createdAt: schema.preregistrations.createdAt });

  const row = inserted[0];
  if (!row) {
    // E-mail už je registrovaný — neprozrazujeme detaily, jen pošleme připomenutí.
    const existing = await db.query.preregistrations.findFirst({
      where: sql`lower(${schema.preregistrations.email}) = ${body.email}`,
    });
    // Zájem o další akci (např. webinář) od už registrovaného e-mailu: doplníme UTM, nic nepřepisujeme.
    if (existing && body.utm) {
      const merged: Record<string, string> = { ...(existing.utm ?? {}) };
      for (const [k, v] of Object.entries(body.utm)) {
        const prev = merged[k];
        merged[k] = prev && prev !== v && !prev.split(",").includes(v) ? `${prev},${v}`.slice(0, 300) : v;
      }
      await db.update(schema.preregistrations).set({ utm: merged }).where(sql`${schema.preregistrations.id} = ${existing.id}`);
    }
    if (existing && !existing.confirmedAt) {
      await enqueueEmail({
        to: existing.email,
        template: "prereg-confirm",
        payload: emailPayload(existing),
        dedupeKey: `prereg-confirm-resend:${existing.id}:${now.toISOString().slice(0, 10)}`,
      });
      after(() => processOutbox(5));
    }
    return Response.json({ ok: true, duplicate: true });
  }

  const [{ value: before } = { value: 0 }] = await db
    .select({ value: count() })
    .from(schema.preregistrations)
    .where(lt(schema.preregistrations.createdAt, row.createdAt));

  await enqueueEmail({
    to: body.email,
    template: "prereg-confirm",
    payload: emailPayload({ companyName, confirmToken, referralCode, unsubscribeToken }, plan),
    dedupeKey: `prereg-confirm:${row.id}`,
  });
  // Plánované informační e-maily k termínům (jen se souhlasem s marketingem).
  if (body.marketingConsent) {
    const dis = TIMELINE.find((t) => t.date === "2026-11-01");
    if (dis && new Date(`${dis.date}T08:00:00+01:00`) > now) {
      await enqueueEmail({
        to: body.email,
        template: "dis-launch",
        payload: { unsubscribeToken },
        dedupeKey: `dis-launch:${row.id}`,
        sendAfter: new Date(`${dis.date}T08:00:00+01:00`),
      });
    }
  }
  after(() => processOutbox(5));

  return Response.json({ ok: true, position: before + 1, referralCode });
}

function emailPayload(
  r: { companyName: string | null; confirmToken: string; referralCode: string; unsubscribeToken: string },
  plan: { date: string; text: string }[] | null = null,
) {
  return {
    companyName: r.companyName,
    confirmToken: r.confirmToken,
    referralCode: r.referralCode,
    unsubscribeToken: r.unsubscribeToken,
    plan: plan ?? TIMELINE.map((t) => ({ date: t.dateLabel, text: t.action })),
  };
}

