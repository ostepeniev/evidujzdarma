import { after } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { isValidIco, normalizeIco } from "@ez/cz";
import { hasDatabase } from "@ez/db";
import { enqueueEmail, processOutbox } from "@/lib/server/mail";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { isJsonRequest } from "@/lib/server/request-guard";
import { EXISTING_POS_SERVICE, SETUP_SERVICE } from "@/content/services";
import { SITE } from "@/lib/site";

/**
 * S5-SLUŽBY: poptávka „Nastavení EET na klíč“ (/nastaveni-na-klic). Poptávka se neukládá do vlastní tabulky – odejde
 * e-mailem provozovateli na SITE.email (přes outbox). Zákazníkovi nic neposíláme: formulář tak nejde zneužít
 * k rozesílání e-mailů na cizí adresy; odpovídá člověk z ahoj@.
 * К13 (31. 10. 2026): balíček „nastaveni“ (výchozí) nebo „pripojeni“ (Připojení stávající pokladny) a nepovinný popis
 * současné pokladny (značka, systém).
 */
const PACKAGES = {
  [SETUP_SERVICE.id]: { name: SETUP_SERVICE.name, price: SETUP_SERVICE.priceLabel },
  [EXISTING_POS_SERVICE.id]: { name: EXISTING_POS_SERVICE.name, price: EXISTING_POS_SERVICE.priceNote },
} as const;

const Body = z.object({
  package: z.enum([SETUP_SERVICE.id, EXISTING_POS_SERVICE.id]).default(SETUP_SERVICE.id),
  email: z.string().trim().toLowerCase().email().max(254),
  ico: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizeIco(v) : null))
    .refine((v) => v === null || isValidIco(v), "Neplatné IČO"),
  establishments: z.enum(["1", "2", "3", "4"]).optional(),
  /** současná pokladna – značka nebo systém (nepovinné) */
  currentPos: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
  /** honeypot – vyplní jen bot */
  website: z.string().max(200).optional(),
});

const FIELD_MESSAGES: Record<string, string> = {
  email: "Zadejte platný e-mail.",
  ico: "IČO má 8 číslic – zkontrolujte ho, nebo pole nechte prázdné.",
  package: "Vyberte, co poptáváte.",
  establishments: "Vyberte počet provozoven.",
  currentPos: "Popis pokladny může mít nejvýš 200 znaků.",
  message: "Zpráva může mít nejvýš 2 000 znaků.",
};

export async function POST(req: Request) {
  // jen JSON – cizí formulář (enctype=text/plain) by obešel CORS (R8.5, Д-5)
  if (!isJsonRequest(req)) return Response.json({ error: "Neplatný požadavek." }, { status: 415 });
  const ip = clientIp(req);
  if (!rateLimit(`poptavka:${ip}`, 5, 3600)) {
    return Response.json({ error: `Příliš mnoho poptávek, zkuste to prosím později nebo napište na ${SITE.email}.` }, { status: 429 });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const field = e instanceof z.ZodError ? String(e.issues[0]?.path[0] ?? "") : "";
    return Response.json({ error: FIELD_MESSAGES[field] ?? "Zkontrolujte prosím formulář.", field: field || undefined }, { status: 400 });
  }
  if (body.website) return Response.json({ ok: true }); // tichý honeypot
  if (!rateLimit(`poptavka-from:${body.email}`, 3, 86_400)) {
    return Response.json({ error: `Tuto poptávku už máme. Odpovíme vám e-mailem, případně napište na ${SITE.email}.` }, { status: 429 });
  }
  if (!hasDatabase()) {
    return Response.json({ error: `Formulář je dočasně nedostupný. Napište nám prosím na ${SITE.email}.` }, { status: 503 });
  }

  const day = new Date().toISOString().slice(0, 10);
  const pkg = PACKAGES[body.package];
  const lines = [
    `Služba: ${pkg.name} (${pkg.price})`,
    `E-mail zákazníka: ${body.email}`,
    `IČO: ${body.ico ?? "—"}`,
    `Počet provozoven: ${body.establishments ? (body.establishments === "4" ? "4 a více" : body.establishments) : "—"}`,
    `Současná pokladna: ${body.currentPos || "—"}`,
    "",
    "Zpráva:",
    body.message || "—",
    "",
    body.package === EXISTING_POS_SERVICE.id
      ? "Odpovězte zákazníkovi do 1 pracovního dne (slib na /nastaveni-na-klic): kterou cestou pokladnu připojit a cenu předem podle systému (bez DPH)."
      : "Odpovězte zákazníkovi do 1 pracovního dne (slib na /nastaveni-na-klic): postup na míru pro DIS+, fakturu až po dokončení.",
  ];
  const hash = createHash("sha256")
    .update(`${body.package}|${body.email}|${body.ico ?? ""}|${body.currentPos ?? ""}|${body.message ?? ""}`)
    .digest("hex")
    .slice(0, 16);
  await enqueueEmail({
    to: SITE.email,
    template: "notice",
    dedupeKey: `poptavka:${day}:${hash}`,
    payload: {
      subject: `Poptávka: ${pkg.name} – ${body.email}`,
      text: lines.join("\n"),
    },
  });
  after(() => processOutbox(5));
  return Response.json({ ok: true });
}
