import { after } from "next/server";
import { recordEvent } from "@/lib/server/analytics";
import { processOutbox } from "@/lib/server/mail";
import { confirmPreregistrationResult } from "@/lib/server/preregistration";
import { SITE_URL } from "@/lib/site";

/** Potvrzení e-mailu tlačítkem na stránce /registrace/potvrzeni – stav se mění jen POSTem (Р5). */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  // po DOI může odejít potvrzení dalšího zájmu (R8.4); neplatný token outbox nebudí – POST je bez přihlášení a limitu (R9.4)
  const result = await confirmPreregistrationResult(token);
  if (result) {
    // trychtýř (R15.1): počet prvních potvrzení za den
    if (result === "confirmed") await recordEvent(req.headers, "prereg_confirmed");
    after(() => processOutbox(5));
  }
  return new Response(null, { status: 303, headers: { location: `${SITE_URL}/registrace/potvrzeni?token=${encodeURIComponent(token)}` } });
}
