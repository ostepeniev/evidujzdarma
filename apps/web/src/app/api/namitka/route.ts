import { after } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { processOutbox } from "@/lib/server/mail";
import { createObjection } from "@/lib/server/objections";
import { isValidIco, normalizeIco } from "@ez/cz";
import { getDb, hasDatabase, schema } from "@ez/db";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { isJsonRequest } from "@/lib/server/request-guard";

/**
 * Námitka dle čl. 21 GDPR / žádost o opravu údajů v katalogu.
 * Uloží se do `objections`. Stránka fyzické osoby se vyřadí z indexace hned, právnické osoby až po
 * potvrzení e-mailu (R3.5). Odpověď do 30 dnů (čl. 12 odst. 3 GDPR).
 */
const Body = z
  .object({
    kind: z.enum(["objection", "correction"]).default("objection"),
    ico: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? normalizeIco(v) : null))
      .refine((v) => v === null || isValidIco(v), "Neplatné IČO"),
    icp: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/\s+/g, "") : null))
      .refine((v) => v === null || /^\d{6,12}$/.test(v), "Neplatné IČP"),
    name: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(254),
    message: z.string().trim().min(10).max(5000),
    /** honeypot — vyplní jen bot */
    website: z.string().max(200).optional(),
  })
  .refine((b) => b.ico || b.icp, { message: "Vyplňte IČO nebo IČP", path: ["ico"] });

const FIELD_MESSAGES: Record<string, string> = {
  ico: "Vyplňte platné IČO (8 číslic) nebo IČP.",
  icp: "IČP má 6–12 číslic.",
  name: "Vyplňte jméno a příjmení.",
  email: "Zadejte platný e-mail.",
  message: "Napište zprávu (alespoň 10 znaků).",
};

export async function POST(req: Request) {
  // jen JSON – cizí formulář (enctype=text/plain) by obešel CORS a limit na IP posílal z IP návštěvníků (R8.5, Д-5)
  if (!isJsonRequest(req)) return Response.json({ error: "Neplatný požadavek." }, { status: 415 });
  const ip = clientIp(req);
  if (!rateLimit(`namitka:${ip}`, 5, 3600)) {
    return Response.json({ error: "Příliš mnoho žádostí, zkuste to prosím později nebo napište e-mail." }, { status: 429 });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const field = e instanceof z.ZodError ? String(e.issues[0]?.path[0] ?? "") : "";
    return Response.json({ error: FIELD_MESSAGES[field] ?? "Zkontrolujte prosím formulář.", field: field || undefined }, { status: 400 });
  }
  if (body.website) return Response.json({ ok: true }); // tichý honeypot
  // e-mail jde na zadanou adresu – nejvýš 3 denně na adresu, i z různých IP (rozesílání na cizí adresu, R7.5)
  if (!rateLimit(`namitka-to:${body.email}`, 3, 86_400)) {
    return Response.json({ error: "Na tuto adresu jsme dnes už poslali několik potvrzení. Zkuste to prosím zítra nebo nám napište e-mail." }, { status: 429 });
  }

  if (!hasDatabase()) {
    return Response.json({ error: "Formulář je dočasně nedostupný. Napište nám prosím e-mail." }, { status: 503 });
  }
  const db = getDb();

  let ico = body.ico;
  let est: { icp: string; slug: string; ico: string } | null = null;
  if (body.icp) {
    const [row] = await db
      .select({ icp: schema.firmEstablishments.icp, slug: schema.firmEstablishments.slug, ico: schema.firmEstablishments.ico })
      .from(schema.firmEstablishments)
      .where(eq(schema.firmEstablishments.icp, body.icp))
      .limit(1);
    if (row) {
      est = row;
      ico ??= row.ico;
    }
  }

  const kind = body.kind === "correction" ? "correction" : "objection";
  // noindex hned jen u fyzických osob, u právnických až po potvrzení e-mailu; provozovatel dostane denní přehled (R3.5)
  await createObjection({ kind, ico: ico ?? est?.ico ?? null, icp: body.icp, name: body.name, email: body.email, message: body.message });
  after(() => processOutbox(5));

  return Response.json({ ok: true });
}
