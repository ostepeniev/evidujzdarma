import { z } from "zod";
import { parseIcoList } from "@ez/cz";
import { HttpError, errorResponse, getCurrentUser } from "@/lib/server/auth";
import { lookupCompany } from "@/lib/server/ares";
import { addClients, requireAccountant } from "@/lib/server/cabinet";
import { parseJson } from "@/lib/server/route-helpers";

const MAX = 500;

/** Přidá klienty podle seznamu IČO. Název doplní z ARES (cache), pokud je rychle k dispozici. */
export async function POST(req: Request) {
  try {
    const accountId = await requireAccountant(await getCurrentUser());
    const { text } = await parseJson(req, z.object({ text: z.string().max(20_000) }));
    const { valid, invalid } = parseIcoList(text);
    if (valid.length > MAX) throw new HttpError(400, `Najednou nejvýše ${MAX} IČO.`);
    const labels = new Map<string, string | null>();
    // názvy jen pro prvních 50 (zbytek doplní stránka katalogu / další návštěva)
    const queue = valid.slice(0, 50);
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let ico = queue.shift(); ico; ico = queue.shift()) {
          try {
            labels.set(ico, (await lookupCompany(ico))?.subject.name ?? null);
          } catch {
            labels.set(ico, null);
          }
        }
      }),
    );
    const added = await addClients(
      accountId,
      valid.map((ico) => ({ ico, label: labels.get(ico) ?? null })),
    );
    return Response.json({ added, duplicates: valid.length - added, invalid });
  } catch (e) {
    return errorResponse(e);
  }
}
