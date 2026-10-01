import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { enqueueEmail, processOutbox } from "@/lib/server/mail";
import { SITE } from "@/lib/site";
import { isValidIco, normalizeIco } from "@ez/cz";
import { getDb, hasDatabase, schema } from "@ez/db";
import { establishmentPath, firmPath } from "@/components/catalog/paths";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

/**
 * Námitka dle čl. 21 GDPR / žádost o opravu údajů v katalogu.
 * Uloží se do `objections` a firma se OKAMŽITĚ vyřadí z indexace (`firms.noindex = true`)
 * až do posouzení. Odpověď do 30 dnů (čl. 12 odst. 3 GDPR).
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

/** Přegenerovat ISR stránku; selhání revalidace nesmí shodit uložení námitky. */
function revalidate(path: string): void {
  try {
    revalidatePath(path);
  } catch (e) {
    console.error("revalidatePath selhalo", path, e);
  }
}

export async function POST(req: Request) {
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

  if (!hasDatabase()) {
    return Response.json({ error: "Formulář je dočasně nedostupný. Napište nám prosím e-mail." }, { status: 503 });
  }
  const db = getDb();

  let ico = body.ico;
  let est: { icp: string; slug: string } | null = null;
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
  await db.insert(schema.objections).values({ kind, ico, icp: body.icp, name: body.name, email: body.email, message: body.message });
  // Provozovatel musí odpovědět do 30 dnů → upozornění do schránky
  await enqueueEmail({
    to: SITE.email,
    template: "notice",
    payload: {
      subject: `${kind === "correction" ? "Oprava údajů" : "Námitka čl. 21 GDPR"}: ${ico ?? body.icp ?? "bez IČO"}`,
      text: `Od: ${body.name} <${body.email}>\nIČO: ${ico ?? "—"} · IČP: ${body.icp ?? "—"}\n\n${body.message}\n\nStránka byla automaticky vyřazena z indexace. Odpovězte do 30 dnů.`,
    },
  });
  after(() => processOutbox(5));

  if (ico) {
    const [firm] = await db
      .update(schema.firms)
      .set({ noindex: true })
      .where(eq(schema.firms.ico, ico))
      .returning({ ico: schema.firms.ico, slug: schema.firms.slug });
    // ISR cache: stránky hned přegenerovat s noindex
    if (firm) {
      revalidate(firmPath(firm));
      const ests = await db
        .select({ icp: schema.firmEstablishments.icp, slug: schema.firmEstablishments.slug })
        .from(schema.firmEstablishments)
        .where(eq(schema.firmEstablishments.ico, firm.ico))
        .limit(200);
      for (const x of ests) revalidate(establishmentPath(x));
    }
  }
  if (est) revalidate(establishmentPath(est));

  return Response.json({ ok: true });
}
