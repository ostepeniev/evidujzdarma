import { HttpError } from "@/lib/server/auth";
import { importCertificate } from "@/lib/server/certificates";
import { ownerRoute } from "@/lib/server/route-helpers";

const MAX_BYTES = 64 * 1024;

export const POST = ownerRoute(async ({ req, accountId }) => {
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
