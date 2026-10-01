import { eq } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { CertificateError, parseP12 } from "@ez/fiscal-core/server";
import { HttpError } from "@/lib/server/auth";
import { storeCertificate } from "@/lib/server/fiscal";
import { ownerRoute } from "@/lib/server/route-helpers";

const MAX_BYTES = 64 * 1024;

export const POST = ownerRoute(async ({ req, accountId }) => {
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Neplatný formulář");
  });
  const file = form.get("file");
  const password = String(form.get("password") ?? "");
  const environment = form.get("environment") === "playground" ? "playground" : "production";
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Vyberte soubor s certifikátem (.p12).");
  if (file.size > MAX_BYTES) throw new HttpError(400, "Soubor je příliš velký – pokladní certifikát má jen pár kB.");

  let cert;
  try {
    cert = parseP12(Buffer.from(await file.arrayBuffer()), password);
  } catch (e) {
    throw new HttpError(400, e instanceof CertificateError ? e.message : "Certifikát se nepodařilo načíst.");
  }
  if (cert.info.validTo.getTime() < Date.now()) throw new HttpError(400, "Certifikát už není platný. Vygenerujte nový v DIS+.");
  if (cert.info.validFrom.getTime() > Date.now() + 86_400_000) throw new HttpError(400, "Certifikát ještě není platný.");

  const db = getDb();
  const account = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) }))!;
  const accountEic = account.eic ?? account.dic;
  if (cert.info.dic && accountEic && cert.info.dic !== accountEic) {
    throw new HttpError(400, `Certifikát patří EIČ ${cert.info.dic}, ale u účtu je ${accountEic}. Zkontrolujte EIČ v nastavení.`);
  }
  if (cert.info.dic && !accountEic) await db.update(schema.accounts).set({ eic: cert.info.dic }).where(eq(schema.accounts.id, accountId));

  const id = await storeCertificate(accountId, cert, environment);
  return Response.json({
    certificate: { id, subject: cert.info.subject, eic: cert.info.dic, environment, validFrom: cert.info.validFrom, validTo: cert.info.validTo },
  });
});
