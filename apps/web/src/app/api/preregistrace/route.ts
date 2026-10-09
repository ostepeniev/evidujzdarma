import { after } from "next/server";
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { isValidIco, normalizeIco } from "@ez/cz";
import { getDb, hasDatabase, schema } from "@ez/db";
import { INDUSTRY_SLUGS } from "@/content/industries";
import { DIS_OPENS, TIMELINE, timelineAt } from "@/content/facts";
import { recordEvent } from "@/lib/server/analytics";
import { enqueueEmail, processOutbox } from "@/lib/server/mail";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { isJsonRequest } from "@/lib/server/request-guard";
import { randomToken, sha256, shortCode } from "@/lib/server/tokens";
import { issueConfirmToken, requestInterestConfirmation, statusTokenFor, unsubscribeTokenFor } from "@/lib/server/preregistration";
import { NOT_CONSENT_PROOF } from "@/lib/server/prereg-proof";
import { MARKETING_CONSENT_VERSION } from "@/lib/legal";
import { lookupCompany } from "@/lib/server/ares";
import { assess } from "@/lib/eet-assessment";
import { INTERESTS } from "@/lib/interests";

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
  /** o co adresa žádá: pokladna (formulář na úvodní stránce), webináře nebo kabinet (formulář pro účetní) – R7.4 */
  interest: z.enum(INTERESTS).default("pokladna"),
  ref: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{4,12}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** jen pět standardních klíčů utm_* (B Дрібне 8) – ostatní se zahodí, ne uloží */
  utm: z
    .record(z.string(), z.unknown())
    .optional()
    .transform((u) => {
      if (!u) return undefined;
      const kept = Object.fromEntries(UTM_KEYS.filter((k) => typeof u[k] === "string" && u[k]).map((k) => [k, (u[k] as string).slice(0, 100)]));
      return Object.keys(kept).length ? kept : undefined;
    }),
  /** honeypot — vyplní jen bot; odpověď je stejná jako pro člověka (B Дрібне 8), i u dlouhé hodnoty (Д3-9) */
  website: z.unknown().optional(),
});

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

/** Stejná odpověď pro novou registraci, opakovanou i pro bota – nic neprozradí (B Дрібне 8, 11). */
const DONE = () => Response.json({ ok: true });

export async function POST(req: Request) {
  // jen JSON – cizí formulář (enctype=text/plain) by obešel CORS a limit na IP posílal z IP návštěvníků (R8.5, Д-5)
  if (!isJsonRequest(req)) return Response.json({ error: "Neplatný požadavek." }, { status: 415 });
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
  if (body.website) return DONE(); // tichý honeypot

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
  const confirm = issueConfirmToken();
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
      // doklad souhlasu = verze jeho textu; čas je v marketing_consent_at, potvrzení e-mailu v confirmed_at (B Дрібне 10)
      consentEvidence: body.marketingConsent ? `souhlas:${MARKETING_CONSENT_VERSION}` : null,
      referralCode,
      referredBy: body.ref ?? null,
      confirmTokenHash: confirm.hash,
      confirmTokenIssuedAt: now,
      utm: body.utm,
    })
    .onConflictDoNothing()
    .returning({ id: schema.preregistrations.id, createdAt: schema.preregistrations.createdAt });

  const row = inserted[0];
  if (!row) {
    // E-mail už je registrovaný — neprozrazujeme detaily, jen pošleme připomenutí. Doklad o odvolaném souhlasu sem nepatří:
    // unikátní index ho nezahrnuje, takže s ním adresa založí novou předregistraci výše (R9.3)
    const existing = await db.query.preregistrations.findFirst({
      where: and(sql`lower(${schema.preregistrations.email}) = ${body.email}`, NOT_CONSENT_PROOF),
    });
    // Cizí záznam bez ověření neměníme – ani UTM (Д3-9). Odhlášené adrese nic neposíláme – o e-mail ji může
    // požádat kdokoli (Д3-9). Odpověď je pro všechny stejná.
    if (existing && !existing.unsubscribedAt) {
      // Nový zájem (webinář, kabinet…) už potvrzené adresy: vlastní potvrzení POSTem, předregistrace se nemění (R7.4)
      if (existing.confirmedAt && (await requestInterestConfirmation(existing, body.interest, now))) {
        after(() => processOutbox(5));
        return DONE();
      }
      // Nepotvrzená adresa: DOI potvrdí jen zájem z prvního vyplnění. Další zájem (formulář mohl vyplnit kdokoli) dostane
      // vlastní token a potvrzení přijde až po DOI (R8.4, Д-3)
      if (!existing.confirmedAt) {
        await db
          .insert(schema.preregistrationInterests)
          .values({ preregistrationId: existing.id, campaign: body.interest, confirmTokenHash: sha256(randomToken()) })
          .onConflictDoNothing();
      }
    }
    // Znovu poslat odkaz, nejvýš jednou denně: nepotvrzenému nový potvrzovací (starý token známe jen jako hash),
    // potvrzenému podepsaný odkaz na stránku stavu – jeho uložený token se nemění, takže opětovné vyplnění formuláře
    // cizím člověkem nezneplatní odkaz, který vlastník už má (R7.16, B M4).
    if (existing && !existing.unsubscribedAt) {
      const fresh = existing.confirmedAt ? null : issueConfirmToken();
      // připomenutí DOI mluví o tom, co DOI potvrdí – ne o zájmu z tohoto (možná cizího) vyplnění (R8.4)
      const [doi] = existing.confirmedAt
        ? []
        : await db
            .select({ campaign: schema.preregistrationInterests.campaign })
            .from(schema.preregistrationInterests)
            .where(and(eq(schema.preregistrationInterests.preregistrationId, existing.id), isNull(schema.preregistrationInterests.confirmTokenHash)));
      const sent = await enqueueEmail({
        to: existing.email,
        template: "prereg-confirm",
        payload: { ...emailPayload(existing, fresh?.token ?? statusTokenFor(existing.id)), alreadyConfirmed: !!existing.confirmedAt, interest: doi?.campaign ?? body.interest },
        dedupeKey: `prereg-confirm-resend:${existing.id}:${now.toISOString().slice(0, 10)}`,
      });
      if (sent) {
        if (fresh) await db.update(schema.preregistrations).set({ confirmTokenHash: fresh.hash, confirmTokenIssuedAt: now }).where(eq(schema.preregistrations.id, existing.id));
        after(() => processOutbox(5));
      }
    }
    return DONE();
  }

  await db.insert(schema.preregistrationInterests).values({ preregistrationId: row.id, campaign: body.interest }).onConflictDoNothing();
  // trychtýř (R15.1): jen počet nových předregistrací za den, bez osobních údajů
  await recordEvent(req.headers, "prereg_submitted", now);
  await enqueueEmail({
    to: body.email,
    template: "prereg-confirm",
    payload: { ...emailPayload({ id: row.id, companyName, referralCode }, confirm.token, plan), interest: body.interest },
    dedupeKey: `prereg-confirm:${row.id}`,
  });
  // Marketingové e-maily se plánují až po potvrzení e-mailu (POST /api/registrace/potvrdit) – Р5.
  // Pořadí a doporučovací odkaz ukáže potvrzovací stránka (ne tato odpověď – B Дрібне 11).
  after(() => processOutbox(5));
  return DONE();
}

function emailPayload(r: { id: string; companyName: string | null; referralCode: string }, confirmToken: string, plan: { date: string; text: string }[] | null = null) {
  return {
    companyName: r.companyName,
    confirmToken,
    referralCode: r.referralCode,
    unsubscribeToken: unsubscribeTokenFor(r.id),
    plan: plan ?? TIMELINE.map((t) => ({ date: t.dateLabel, text: t.action })),
  };
}

