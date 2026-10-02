import { P12_LIMITS } from "@ez/fiscal-core/server";
import { HttpError, requireFreshLogin } from "@/lib/server/auth";
import { importCertificate } from "@/lib/server/certificates";
import { rateLimit } from "@/lib/server/rate-limit";
import { ownerRoute } from "@/lib/server/route-helpers";

const MAX_BYTES = P12_LIMITS.maxBytes;
/** formulář = soubor + heslo + hranice multipart */
const MAX_BODY = MAX_BYTES + 8 * 1024;

export const POST = ownerRoute(async ({ req, user, accountId }) => {
  requireFreshLogin(user);
  // velikost se kontroluje před načtením těla (R3.1); chybějící Content-Length nepřijímáme
  const length = Number(req.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(length)) throw new HttpError(411, "Chybí délka požadavku.");
  if (length > MAX_BODY) throw new HttpError(413, "Soubor je příliš velký – pokladní certifikát má jen pár kB.");
  if (!rateLimit(`cert-import:${accountId}`, 5, 3600)) throw new HttpError(429, "Certifikát lze nahrát nejvýše 5× za hodinu. Zkuste to prosím později.");
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Neplatný formulář");
  });
  const file = form.get("file");
  const password = String(form.get("password") ?? "");
  // formulář říká, co vlastník čeká; prostředí ale určuje vydavatel certifikátu (R1.9)
  const env = form.get("environment");
  const expected = env === "playground" || env === "production" ? env : undefined;
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Vyberte soubor s certifikátem (.p12).");
  if (file.size > MAX_BYTES) throw new HttpError(400, "Soubor je příliš velký – pokladní certifikát má jen pár kB.");
  const certificate = await importCertificate(accountId, { file: Buffer.from(await file.arrayBuffer()), password, expected });
  return Response.json({ certificate });
});
