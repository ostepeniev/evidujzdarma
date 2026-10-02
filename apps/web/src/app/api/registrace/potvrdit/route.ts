import { confirmPreregistration } from "@/lib/server/preregistration";
import { SITE_URL } from "@/lib/site";

/** Potvrzení e-mailu tlačítkem na stránce /registrace/potvrzeni – stav se mění jen POSTem (Р5). */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  await confirmPreregistration(token);
  return new Response(null, { status: 303, headers: { location: `${SITE_URL}/registrace/potvrzeni?token=${encodeURIComponent(token)}` } });
}
