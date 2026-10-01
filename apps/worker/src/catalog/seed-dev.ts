/**
 * Syntetická data katalogu pro vývoj (≈300 zjevně vymyšlených subjektů).
 *
 *   DATABASE_URL=… pnpm --filter @ez/worker catalog:seed [-- --count 300] [--clear]
 *
 * IČO mají platnou kontrolní číslici v rozsahu 9900001x–990030xx a názvy začínají „Ukázkov…“,
 * takže je nelze zaměnit se skutečnými firmami. Skript je idempotentní: nejdřív smaže
 * předchozí seed (jen řádky odpovídající obojímu vzoru), `--clear` jen maže.
 */
import { and, like, sql } from "drizzle-orm";
import { classifyNaceList, classifyTrades, icoCheckDigit, slugify } from "@ez/cz";
import { closeDb, getDb, schema } from "@ez/db";
import { argNumber, log, parseArgs, requireDatabaseUrl, todayIso } from "./common.ts";

type Region = { code: number; cities: { name: string; code: number; psc: string }[] };

const REGIONS: Region[] = [
  {
    code: 51,
    cities: [
      { name: "Karlovy Vary", code: 554961, psc: "36001" },
      { name: "Cheb", code: 554481, psc: "35002" },
      { name: "Sokolov", code: 560286, psc: "35601" },
      { name: "Mariánské Lázně", code: 554642, psc: "35301" },
      { name: "Ostrov", code: 555428, psc: "36301" },
      { name: "Aš", code: 554499, psc: "35201" },
    ],
  },
  { code: 19, cities: [{ name: "Praha", code: 554782, psc: "11000" }] },
  { code: 116, cities: [{ name: "Brno", code: 582786, psc: "60200" }] },
  { code: 43, cities: [{ name: "Plzeň", code: 554791, psc: "30100" }] },
  { code: 132, cities: [{ name: "Ostrava", code: 554821, psc: "70200" }] },
  { code: 78, cities: [{ name: "Liberec", code: 563889, psc: "46001" }] },
  { code: 124, cities: [{ name: "Olomouc", code: 500496, psc: "77900" }] },
  { code: 35, cities: [{ name: "České Budějovice", code: 544256, psc: "37001" }] },
  { code: 86, cities: [{ name: "Hradec Králové", code: 569810, psc: "50002" }] },
  { code: 94, cities: [{ name: "Pardubice", code: 555134, psc: "53002" }] },
  { code: 108, cities: [{ name: "Jihlava", code: 586846, psc: "58601" }] },
  { code: 141, cities: [{ name: "Zlín", code: 585068, psc: "76001" }] },
  { code: 60, cities: [{ name: "Ústí nad Labem", code: 554804, psc: "40001" }] },
  { code: 27, cities: [{ name: "Kladno", code: 532053, psc: "27201" }] },
];

/** NACE kódy + typické živnosti pro provozovny */
const PROFILES: { nace: string[]; trades: string[] }[] = [
  { nace: ["96021"], trades: ["Holičství, kadeřnictví"] },
  { nace: ["96022"], trades: ["Kosmetické služby", "Pedikúra, manikúra"] },
  { nace: ["55100", "56101"], trades: ["Hostinská činnost", "Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona"] },
  { nace: ["56101"], trades: ["Hostinská činnost"] },
  { nace: ["47110"], trades: ["Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona"] },
  { nace: ["4520"], trades: ["Opravy silničních vozidel"] },
  { nace: ["43210"], trades: ["Montáž, opravy, revize a zkoušky elektrických zařízení"] },
  { nace: ["43320"], trades: ["Truhlářství, podlahářství"] },
  { nace: ["62010"], trades: ["Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona"] },
  { nace: ["69200"], trades: ["Vedení účetnictví"] },
  { nace: ["4932"], trades: ["Silniční motorová doprava - osobní provozovaná vozidly určenými pro přepravu nejvýše 9 osob včetně řidiče"] },
  { nace: ["01110", "47810"], trades: ["Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona"] },
  { nace: ["46900"], trades: ["Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona"] },
  { nace: ["85590"], trades: ["Mimoškolní výchova a vzdělávání, pořádání kurzů, školení, včetně lektorské činnosti"] },
  { nace: ["93130"], trades: ["Poskytování tělovýchovných a sportovních služeb v oblasti tělesné výchovy a sportu"] },
];

/** deterministický PRNG (mulberry32) — stejná data při každém spuštění */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedIco(i: number): string {
  const first7 = String(9900000 + i).padStart(7, "0");
  return `${first7}${icoCheckDigit(first7)}`;
}

const pad = (n: number, w = 3) => String(n).padStart(w, "0");

async function main() {
  requireDatabaseUrl();
  const args = parseArgs();
  const total = Math.min(2000, Math.max(1, argNumber(args, "count", 300)));
  const db = getDb();

  const deleted = await db
    .delete(schema.firms)
    .where(and(like(schema.firms.ico, "990%"), like(schema.firms.name, "Ukázkov%")))
    .returning({ ico: schema.firms.ico });
  log(`smazáno ${deleted.length} předchozích ukázkových subjektů`);
  if (args.clear) return;

  const rnd = prng(20270101);
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  const firms: (typeof schema.firms.$inferInsert)[] = [];
  const ests: (typeof schema.firmEstablishments.$inferInsert)[] = [];

  for (let i = 1; i <= total; i++) {
    const ico = seedIco(i);
    const region = i % 5 < 2 ? REGIONS[0]! : REGIONS[1 + (i % (REGIONS.length - 1))]!;
    const city = region.cities[Math.floor(rnd() * region.cities.length)]!;
    const profile = PROFILES[i % PROFILES.length]!;
    const natural = i % 9 < 4;
    const kind = natural ? "osvc" : i % 11 === 0 ? "as" : i % 23 === 0 ? "spolek" : "sro";
    const name =
      kind === "osvc"
        ? `${i % 2 ? "Ukázková Podnikatelka" : "Ukázkový Podnikatel"} ${pad(i)}`
        : kind === "as"
          ? `Ukázková akciová ${pad(i)} a.s.`
          : kind === "spolek"
            ? `Ukázkový spolek ${pad(i)}, z.s.`
            : `Ukázková firma ${pad(i)} s.r.o.`;
    const legalForm = kind === "osvc" ? "101" : kind === "as" ? "121" : kind === "spolek" ? "706" : "112";

    // ~10 % subjektů vzniklo v posledních 3 měsících (stránky /firmy/nove/…)
    let founded: string;
    if (i % 10 === 0) {
      const d = new Date(`${thisMonth}-15T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - (i % 3));
      d.setUTCDate(1 + Math.floor(rnd() * 27));
      founded = d.toISOString().slice(0, 10);
      if (founded > today) founded = today;
    } else {
      const y = 1995 + Math.floor(rnd() * 31);
      const m = 1 + Math.floor(rnd() * 12);
      const day = 1 + Math.floor(rnd() * 28);
      founded = `${Math.min(y, 2025)}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    const dissolved = i % 37 === 0 ? "2024-06-30" : null;
    const verified = i % 10 !== 5; // ~10 % zatím neověřeno v ARES
    const vatPayer = !natural && i % 2 === 0;
    const firmRel = classifyNaceList(profile.nace).relevance;

    let estCount = 0;
    if (verified && !dissolved && i % 3 === 0) {
      estCount = 1 + (i % 3 === 0 && i % 2 === 0 ? 1 : 0) + (i % 27 === 0 ? 1 : 0);
      for (let k = 1; k <= estCount; k++) {
        const icp = `99${pad(i, 5)}${pad(k, 3)}`;
        const estName = natural ? null : k === 1 ? `Ukázková provozovna ${pad(i)}` : `Ukázková provozovna ${pad(i)}-${k}`;
        ests.push({
          icp,
          ico,
          name: estName,
          slug: slugify(estName ?? `${name} ${city.name}`, 80),
          street: natural ? null : `Ukázková ${10 + k}`,
          city: city.name,
          cityCode: city.code,
          postalCode: city.psc,
          regionCode: region.code,
          trades: profile.trades,
          eetRelevance: classifyTrades(profile.trades) ?? firmRel,
          startedAt: founded,
          endedAt: null,
        });
      }
      // jedna ukončená provozovna (nesmí se zobrazit)
      if (i % 12 === 0) {
        ests.push({
          icp: `99${pad(i, 5)}900`,
          ico,
          name: natural ? null : `Ukázková ukončená provozovna ${pad(i)}`,
          slug: slugify(`ukazkova ukoncena provozovna ${pad(i)}`, 80),
          city: city.name,
          regionCode: region.code,
          trades: profile.trades,
          eetRelevance: firmRel,
          startedAt: founded,
          endedAt: "2025-12-31",
        });
      }
    }

    firms.push({
      ico,
      name,
      slug: slugify(name, 80),
      legalForm,
      isNaturalPerson: natural,
      dic: natural ? null : `CZ${ico}`,
      vatPayer,
      foundedAt: founded,
      dissolvedAt: dissolved,
      aresUpdatedAt: verified ? today : null,
      street: natural ? null : `Ukázková ${i}`,
      city: city.name,
      cityCode: city.code,
      postalCode: city.psc,
      regionCode: region.code,
      nace: profile.nace,
      eetRelevance: firmRel,
      establishmentsCount: estCount,
      noindex: i % 53 === 0, // simulace námitky
      syncedAt: new Date(),
    });
  }

  for (let i = 0; i < firms.length; i += 500) await db.insert(schema.firms).values(firms.slice(i, i + 500));
  for (let i = 0; i < ests.length; i += 500) await db.insert(schema.firmEstablishments).values(ests.slice(i, i + 500));

  const [stats] = await db.execute<{ firms: number; kv: number; ests: number }>(sql`
    select (select count(*)::int from firms where ico like '990%') as firms,
           (select count(*)::int from firms where ico like '990%' and region_code = 51) as kv,
           (select count(*)::int from firm_establishments where ico like '990%') as ests`);
  log(`vloženo: ${stats?.firms} subjektů (${stats?.kv} v Karlovarském kraji), ${stats?.ests} provozoven`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
