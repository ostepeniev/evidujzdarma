import Link from "next/link";
import { krajByCode } from "@ez/cz";
import { isClosed } from "@/lib/launch";
import { catalogIndustry } from "./industry";
import { oborKrajPath, oborObecPath } from "./paths";

/**
 * S3 – prolinkování návodů s katalogem firem: oborový návod → obor × kraj a obor × obec pro krajské město Karlovarského
 * kraje. Návody jsou statické (generateStaticParams), proto pevný seznam bez dotazu do DB: obor × kraj se indexuje,
 * kdykoli má kraj v oboru aspoň jeden subjekt, obor × obec Karlovy Vary od 5 subjektů ověřených v ARES – u těchto
 * čtyř hlavních oborů krajského města s velkou rezervou (ověří kontrolor po obohacení z ARES, viz zpráva S3).
 */
export const GUIDE_CATALOG_LINKS: Readonly<Record<string, string>> = {
  "eet-kadernictvi-kosmetika": "kadernictvi-a-kosmetika",
  "eet-gastronomie": "restaurace-a-kavarny",
  "eet-ubytovani": "ubytovani",
  "eet-trhy-stanky": "maloobchod",
};

export const GUIDE_CATALOG_KRAJ = 51;
export const GUIDE_CATALOG_OBEC = { code: 554961, name: "Karlovy Vary" } as const;

export function GuideCatalogLinks({ slug }: { slug: string }) {
  const industry = catalogIndustry(GUIDE_CATALOG_LINKS[slug] ?? "");
  const kraj = krajByCode(GUIDE_CATALOG_KRAJ);
  if (!industry || !kraj || isClosed("/firmy")) return null;
  return (
    <aside aria-labelledby="katalog-oboru" className="rounded-2xl border border-line bg-surface p-6">
      <h2 id="katalog-oboru" className="text-xl font-bold text-ink">
        {industry.headline} v katalogu firem
      </h2>
      <p className="mt-1 text-[15px] text-ink-soft">Firmy z veřejných registrů s odhadem, zda se jich týká EET 2.0.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        <li>
          <Link href={oborObecPath(industry.slug, GUIDE_CATALOG_OBEC)} className="inline-block rounded-full border border-line bg-white px-4 py-2 text-[15px] hover:border-brand-500 hover:bg-brand-50">
            {industry.headline} {GUIDE_CATALOG_OBEC.name}
          </Link>
        </li>
        <li>
          <Link href={oborKrajPath(industry.slug, kraj.slug)} className="inline-block rounded-full border border-line bg-white px-4 py-2 text-[15px] hover:border-brand-500 hover:bg-brand-50">
            {industry.headline} {kraj.locative}
          </Link>
        </li>
      </ul>
    </aside>
  );
}
