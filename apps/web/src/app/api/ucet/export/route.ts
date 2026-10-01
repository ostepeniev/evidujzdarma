import { and, asc, eq, gte, lt } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { decimalString } from "@ez/fiscal-core";

/** Český Excel očekává desetinnou čárku. */
const num = (h: number) => decimalString(h).replace(".", ",");
import { ownerRoute } from "@/lib/server/route-helpers";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const METHODS = ["cash", "card", "qr", "voucher", "transfer"] as const;

/** Export tržeb pro účetní (CSV pro český Excel: středník, UTF-8 s BOM). */
export const GET = ownerRoute(async ({ req, accountId }) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("od") ?? new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);
  const to = url.searchParams.get("do") ?? new Date().toISOString().slice(0, 10);
  const fromD = new Date(`${from}T00:00:00+01:00`);
  const toD = new Date(new Date(`${to}T00:00:00+01:00`).getTime() + 86_400_000);
  const db = getDb();
  const rows = await db
    .select({ sale: schema.sales, unit: schema.evidenceUnits.label, staff: schema.staff.name })
    .from(schema.sales)
    .leftJoin(schema.evidenceUnits, eq(schema.evidenceUnits.id, schema.sales.unitId))
    .leftJoin(schema.staff, eq(schema.staff.id, schema.sales.staffId))
    .where(and(eq(schema.sales.accountId, accountId), gte(schema.sales.soldAt, fromD), lt(schema.sales.soldAt, toD)))
    .orderBy(asc(schema.sales.soldAt));

  const header = [
    "Datum a čas",
    "Pokladna",
    "Evidenční jednotka",
    "Pořadové číslo",
    "Celkem",
    "Hotovost",
    "Karta",
    "QR platba",
    "Poukaz/záloha",
    "Převod",
    "Spropitné",
    "Sleva",
    "Základ 21 %",
    "DPH 21 %",
    "Základ 12 %",
    "DPH 12 %",
    "Základ 0 %",
    "Evidovaná částka",
    "POK",
    "Stav",
    "Režim",
    "Vratka k",
    "Pokladní",
  ];
  const fmt = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Prague" });
  const lines = rows.map(({ sale: s, unit, staff }) => {
    const byMethod = Object.fromEntries(METHODS.map((m) => [m, s.payments.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0)]));
    const vat = s.vatBreakdown ?? {};
    return [
      fmt.format(s.soldAt),
      s.registerId,
      unit ?? "",
      s.sequence,
      num(s.total),
      ...METHODS.map((m) => num(byMethod[m] ?? 0)),
      num(s.tip),
      num(s.discount),
      vat["21"] ? num(vat["21"].base) : "",
      vat["21"] ? num(vat["21"].vat) : "",
      vat["12"] ? num(vat["12"].base) : "",
      vat["12"] ? num(vat["12"].vat) : "",
      vat["0"] ? num(vat["0"].base) : "",
      num(s.evidencedTotal),
      s.confirmationCode ?? "",
      s.status,
      s.mode,
      s.refundOf ?? "",
      staff ?? "",
    ]
      .map(csvCell)
      .join(";");
  });
  const body = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="trzby-${from}-${to}.csv"`,
    },
  });
});
