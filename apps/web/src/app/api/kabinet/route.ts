import { eq } from "drizzle-orm";
import { z } from "zod";
import { isValidIco, normalizeIco } from "@ez/cz";
import { getDb, schema } from "@ez/db";
import { HttpError, errorResponse, getCurrentUser } from "@/lib/server/auth";
import { accountantMembership, cabinetClients, createAccountantAccount } from "@/lib/server/cabinet";
import { parseJson } from "@/lib/server/route-helpers";
import { SITE_URL } from "@/lib/site";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Nejste přihlášeni");
    const m = accountantMembership(user);
    if (!m) return Response.json({ user: { email: user.email }, account: null, clients: [] });
    const account = await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, m.accountId) });
    return Response.json({ user: { email: user.email }, account: { id: account!.id, name: account!.name, ico: account!.ico }, clients: await cabinetClients(m.accountId, SITE_URL) });
  } catch (e) {
    return errorResponse(e);
  }
}

const Body = z.object({
  name: z.string().trim().min(2).max(200),
  ico: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizeIco(v) : null))
    .refine((v) => v === null || isValidIco(v), "Neplatné IČO"),
  acceptTerms: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Nejste přihlášeni");
    const input = await parseJson(req, Body);
    await createAccountantAccount(user, input);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
