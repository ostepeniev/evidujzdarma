import { confirmInterest } from "@/lib/server/preregistration";
import { SITE_URL } from "@/lib/site";

/** Potvrzení zájmu už známé adresy tlačítkem na stránce /registrace/zajem – stav se mění jen POSTem (Р5, R7.4). */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  await confirmInterest(token);
  return new Response(null, { status: 303, headers: { location: `${SITE_URL}/registrace/zajem?token=${encodeURIComponent(token)}` } });
}
