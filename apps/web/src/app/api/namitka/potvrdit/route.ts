import { confirmObjection } from "@/lib/server/objections";
import { SITE_URL } from "@/lib/site";

/** Potvrzení námitky tlačítkem (POST) – odkaz v e-mailu sám nic nemění. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const ok = await confirmObjection(String(form?.get("token") ?? ""));
  return new Response(null, { status: 303, headers: { location: `${SITE_URL}/namitka/potvrzeni?${ok ? "hotovo=1" : "neplatne=1"}` } });
}
