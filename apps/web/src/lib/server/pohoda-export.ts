import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { pohodaDayDocs, pohodaXml, type PohodaSale } from "@/lib/pohoda-xml";
import { DAY_RE, pragueDayRange, pragueToday } from "@/lib/prague-time";
import { HttpError } from "./auth";

/**
 * S11: export tržeb jedné firmy do POHODY (XML, beta) – jen ostrý provoz (mode = production); tržby v ukázkovém
 * a testovacím režimu nejsou účetní doklady. Vratky jsou záporné tržby a v souhrnu dne se odečtou.
 */

/** Zkratka pokladny v POHODĚ (výchozí „HP“ – Hlavní pokladna). */
const CASH_ACCOUNT_RE = /^[\p{L}\p{N} ._-]{1,19}$/u;

export interface PohodaRequest {
  from: string;
  to: string;
  cashAccount: string;
}

export function pohodaParams(url: URL): PohodaRequest {
  const from = url.searchParams.get("od") ?? pragueToday(new Date(Date.now() - 31 * 86_400_000));
  const to = url.searchParams.get("do") ?? pragueToday();
  if (!DAY_RE.test(from) || !DAY_RE.test(to)) throw new HttpError(400, "Datum ve tvaru RRRR-MM-DD");
  if (from > to) throw new HttpError(400, "Datum „od“ je po datu „do“");
  const cashAccount = (url.searchParams.get("pokladna") ?? "HP").trim() || "HP";
  if (!CASH_ACCOUNT_RE.test(cashAccount)) throw new HttpError(400, "Zkratka pokladny v Pohodě: nejvýš 19 znaků (písmena, číslice).");
  return { from, to, cashAccount };
}

export async function pohodaExportResponse(accountId: string, req: PohodaRequest): Promise<Response> {
  const db = getDb();
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId), columns: { ico: true } });
  if (!account?.ico) throw new HttpError(400, "Pro export do Pohody doplňte v nastavení IČO firmy – Pohoda ho při importu kontroluje.");
  const { start, end } = pragueDayRange(req.from, req.to);
  const rows = await db
    .select({ sale: schema.sales, unit: schema.evidenceUnits.label })
    .from(schema.sales)
    .leftJoin(schema.evidenceUnits, eq(schema.evidenceUnits.id, schema.sales.unitId))
    .where(and(eq(schema.sales.accountId, accountId), eq(schema.sales.mode, "production"), gte(schema.sales.soldAt, start), lt(schema.sales.soldAt, end)))
    .orderBy(asc(schema.sales.soldAt));
  const sales: PohodaSale[] = rows.map(({ sale: s, unit }) => ({
    soldAt: s.soldAt,
    unitKey: s.unitId ?? `fs${s.fsUnitId}`,
    unitLabel: unit ?? `Evidenční jednotka ${s.fsUnitId}`,
    total: s.total,
    payments: s.payments,
    vatBreakdown: s.vatBreakdown ?? null,
  }));
  if (!pohodaDayDocs(sales).length) throw new HttpError(404, "V tomto období nejsou žádné tržby v ostrém provozu – soubor pro Pohodu by byl prázdný.");
  const xml = pohodaXml(sales, { ico: account.ico, cashAccount: req.cashAccount, packId: `ez-${account.ico}-${req.from}-${req.to}` });
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="pohoda-trzby-${account.ico}-${req.from}-${req.to}.xml"`,
      "cache-control": "no-store",
    },
  });
}
