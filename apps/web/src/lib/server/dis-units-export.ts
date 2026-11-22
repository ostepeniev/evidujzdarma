import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { buildDisUnitsCsv } from "@/lib/dis-units-csv";
import { pragueToday } from "@/lib/prague-time";
import { HttpError } from "./auth";

/**
 * S12 (22. 11. 2026): CSV pro hromadný import evidenčních jednotek do DIS+ (lib/dis-units-csv.ts). Aktivní jednotky
 * jedné firmy; výchozí jen ty, které ještě nemají číslo z DIS+ (už oznámené by se v DIS+ založily podruhé), ?vse=1 všechny.
 * Chybí-li údaje, vrací 422 se seznamem jednotek a toho, co doplnit – soubor nevznikne.
 */
export function disUnitsParams(url: URL): { all: boolean } {
  return { all: url.searchParams.get("vse") === "1" };
}

export async function disUnitsCsvResponse(accountId: string, opts: { all: boolean }): Promise<Response> {
  const db = getDb();
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId), columns: { ico: true } });
  const units = await db
    .select()
    .from(schema.evidenceUnits)
    .where(
      and(
        eq(schema.evidenceUnits.accountId, accountId),
        eq(schema.evidenceUnits.active, true),
        ...(opts.all ? [] : [isNull(schema.evidenceUnits.fsUnitId)]),
      ),
    )
    .orderBy(asc(schema.evidenceUnits.createdAt));
  if (!units.length) {
    throw new HttpError(
      404,
      opts.all
        ? "Žádná aktivní evidenční jednotka – nejdřív ji přidejte v nastavení pokladny."
        : "Všechny jednotky už mají číslo z DIS+, nemáte co importovat. Pro soubor se všemi jednotkami použijte volbu „i jednotky s číslem z DIS+“.",
    );
  }
  const r = buildDisUnitsCsv(units);
  if (!r.ok) throw new HttpError(422, r.error, { units: r.units });
  const name = `dis-jednotky-${account?.ico ?? "firma"}-${pragueToday()}.csv`;
  return new Response(r.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
