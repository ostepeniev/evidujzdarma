import { z } from "zod";
import { legalFormShort, parseIcoList } from "@ez/cz";
import { BULK_MAX_BATCH, BULK_REQ_PER_MIN, type BulkResponse, type BulkRow } from "@/components/accountant/bulk-check-shared";
import { assess } from "@/lib/eet-assessment";
import { lookupCompany } from "@/lib/server/ares";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

/**
 * Hromadná kontrola IČO pro účetní: až 50 IČO na požadavek, dotazy do ARES se souběhem 4.
 *
 * Ochrana registru ARES (limit cca 500 dotazů/min): kromě limitu na IP držíme i globální
 * rozpočet vyhledání pro tento endpoint. Co se do rozpočtu nevejde, vrátíme jako `busy`
 * a klient to po `retryAfter` sekundách pošle znovu.
 */
const CONCURRENCY = 4;
const GLOBAL_LOOKUPS_PER_MIN = 240;
const RETRY_AFTER_S = 15;

const Body = z.object({
  icos: z.array(z.string().max(32)).min(1).max(BULK_MAX_BATCH * 2),
});

async function checkOne(ico: string): Promise<BulkRow> {
  const empty: BulkRow = { ico, name: null, legalForm: null, city: null, verdict: null, eetOff: null, establishments: null, error: null };
  if (!rateLimit("ico-bulk:global", GLOBAL_LOOKUPS_PER_MIN, 60)) return { ...empty, error: "busy" };
  try {
    const found = await lookupCompany(ico, { pool: "bulk" });
    if (!found) return { ...empty, error: "not_found" };
    const a = assess(found.subject, found.rzp);
    return {
      ico,
      name: found.subject.name,
      legalForm: legalFormShort(found.subject.legalForm),
      city: found.subject.address.city,
      verdict: a.verdict,
      eetOff: a.eetOff,
      establishments: a.activeEstablishments,
      error: null,
    };
  } catch {
    return { ...empty, error: "ares_unavailable" };
  }
}

async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`ico-bulk:${ip}`, BULK_REQ_PER_MIN, 60)) {
    return Response.json(
      { error: "Příliš mnoho dotazů za minutu. Kontrola bude pokračovat za chvíli." },
      { status: 429, headers: { "retry-after": String(Math.ceil(60 / BULK_REQ_PER_MIN)) } },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Pošlete seznam IČO v poli „icos“." }, { status: 400 });
  }

  const { valid, invalid } = parseIcoList(body.icos.join("\n"));
  if (valid.length > BULK_MAX_BATCH) {
    return Response.json({ error: `Najednou lze poslat nejvýše ${BULK_MAX_BATCH} IČO.` }, { status: 400 });
  }

  const rows = await mapPool(valid, CONCURRENCY, checkOne);
  const payload: BulkResponse = {
    rows,
    invalid,
    checkedAt: new Date().toISOString(),
    ...(rows.some((r) => r.error === "busy") ? { retryAfter: RETRY_AFTER_S } : {}),
  };
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}
