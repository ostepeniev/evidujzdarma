import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { FACTS, FACTS_UPDATED, SOURCES } from "@/content/facts";
import { JsonLd } from "@/lib/jsonld";
import { OPERATOR, SITE, SITE_URL, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "O nás a kontakt",
  description:
    "Kdo stojí za EvidujZdarma: nezávislá služba firmy Swipe Scape s.r.o., ne Finanční správy. Jak ověřujeme fakta o EET 2.0, kde ukládáme data a jak nás kontaktovat",
  alternates: { canonical: "/o-nas" },
};

/** Změny faktů a obsahu viditelné pro čtenáře (nejnovější nahoře). */
const CHANGELOG: readonly { date: string; text: string }[] = [
  {
    date: "2026-10-01",
    text: `Ověřili jsme všechna fakta k EET 2.0 po podpisu zákona prezidentem (${FACTS.law.signedOn}): harmonogram, EET OFF, evidenční jednotky, certifikáty a informace o MOJE eet.`,
  },
];

const PRINCIPLES = [
  {
    title: "Jediný zdroj faktů",
    text: "Všechna tvrzení o EET 2.0 (termíny, částky, podmínky) vedeme na jednom místě a ke každému uvádíme oficiální zdroj – nejčastěji eet.gov.cz, Finanční správu nebo Ministerstvo financí.",
  },
  {
    title: "Revize daňovým poradcem",
    text: "Návody a texty nástrojů procházejí revizí daňového poradce. Jeho jméno a evidenční číslo zde uvedeme po dokončení první revize.",
  },
  {
    title: "Datum ověření",
    text: `U nástrojů a návodů uvádíme, ke kterému dni jsme fakta ověřili. Naposledy ${new Date(FACTS_UPDATED).toLocaleDateString("cs-CZ")}.`,
  },
  {
    title: "Opatrnost tam, kde jasno není",
    text: "Co zatím není oficiálně zveřejněné, označujeme jako předběžné nebo to vůbec neuvádíme. Výsledky nástrojů jsou orientační, nenahrazují daňové poradenství.",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "O nás a kontakt",
          url: absoluteUrl("/o-nas"),
          inLanguage: "cs-CZ",
          dateModified: FACTS_UPDATED,
          mainEntity: { "@id": `${SITE_URL}/#organization` },
        }}
      />
      <PageHeader
        title="O nás a kontakt"
        crumbs={[{ name: "O nás", path: "/o-nas" }]}
        lead="EvidujZdarma chce, aby evidence tržeb nestála malé podnikatele ani korunu navíc a co nejméně času. Proto stavíme bezplatnou pokladnu a srozumitelné nástroje k EET 2.0."
      />

      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-14">
          <section aria-labelledby="nezavislost" className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-6 sm:p-8">
            <h2 id="nezavislost" className="text-2xl font-bold tracking-tight">
              Jsme nezávislí – nejsme stát
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-ink">
              EvidujZdarma provozuje soukromá firma {OPERATOR.name}. Nejsme Finanční správa, Ministerstvo financí ani jejich
              smluvní partner a nemáme u nich žádné zvláštní postavení. Nepoužíváme státní symboly ani vizuální styl státních
              webů.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Oficiální informace a bezplatnou státní aplikaci MOJE eet najdete na{" "}
              <a href={SOURCES.eetGov.url} className="font-medium text-brand-700 underline underline-offset-4" rel="noopener">
                eet.gov.cz
              </a>
              . Jak se od ní lišíme, férově popisujeme ve{" "}
              <Link href="/srovnani/moje-eet" className="font-medium text-brand-700 underline underline-offset-4">
                srovnání s MOJE eet
              </Link>
              .
            </p>
          </section>

          <section aria-labelledby="mise" className="prose-ez">
            <h2 id="mise" className="mt-0">
              Proč EvidujZdarma vzniklo
            </h2>
            <p>
              Od roku 2027 se vrací evidence tržeb. Pro kadeřnici, stánkaře nebo řemeslníka to znamená nové povinnosti, nové
              pojmy a rozhodování, zda a jakou pokladnu pořídit. Chceme, aby odpověď byla jednoduchá: zjistit si zdarma, zda se
              vás evidence týká, a když ano, evidovat v pokladně, která je zdarma navždy a funguje i bez signálu.
            </p>
            <p>
              Vyděláváme na placených doplňcích, které si každý může, ale nemusí zapnout – například SMS účtenky, export do
              účetních programů nebo platba kartou v telefonu. Podrobnosti najdete v <Link href="/cenik">ceníku</Link>. Data
              uživatelů neprodáváme.
            </p>
          </section>

          <section aria-labelledby="presnost">
            <h2 id="presnost" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Jak zajišťujeme přesnost
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="card">
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{p.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[15px] text-ink-soft">
              Našli jste chybu nebo zastaralý údaj? Napište nám na{" "}
              <a href={`mailto:${SITE.email}`} className="font-medium text-brand-700 underline underline-offset-4">
                {SITE.email}
              </a>{" "}
              – opravu zapíšeme do přehledu změn níže.
            </p>
          </section>

          <section aria-labelledby="zmeny">
            <h2 id="zmeny" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Přehled změn
            </h2>
            <ol className="mt-6 space-y-4 border-l-2 border-line pl-6">
              {CHANGELOG.map((c) => (
                <li key={c.date + c.text}>
                  <time dateTime={c.date} className="text-sm font-semibold text-brand-700">
                    {new Date(c.date).toLocaleDateString("cs-CZ")}
                  </time>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{c.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="data" className="prose-ez">
            <h2 id="data" className="mt-0">
              Data a bezpečnost
            </h2>
            <ul>
              <li>Data pokladen ukládáme na serverech v Evropské unii, privátní klíče pokladních certifikátů šifrovaně. Heslo k certifikátu neukládáme.</li>
              <li>Osobní údaje nepředáváme mimo EU a neprodáváme je.</li>
              <li>
                Údaje o firmách v nástrojích bereme z veřejných registrů (ARES). U fyzických osob nezobrazujeme adresu bydliště.
              </li>
            </ul>
            <p>
              Podrobnosti najdete v <Link href="/ochrana-osobnich-udaju">zásadách ochrany osobních údajů</Link> a v{" "}
              <Link href="/podminky">obchodních podmínkách</Link>.
            </p>
          </section>

          <section id="kontakt" aria-labelledby="kontakt-h" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h2 id="kontakt-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Kontakt
            </h2>
            <dl className="mt-6 grid gap-x-8 gap-y-4 text-[15px] sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold text-ink">E-mail</dt>
              <dd>
                <a href={`mailto:${SITE.email}`} className="font-medium text-brand-700 underline underline-offset-4">
                  {SITE.email}
                </a>
              </dd>
              <dt className="font-semibold text-ink">Provozovatel</dt>
              <dd className="text-ink-soft">{OPERATOR.name}</dd>
              <dt className="font-semibold text-ink">IČO / DIČ</dt>
              <dd className="text-ink-soft">
                {OPERATOR.ico} / {OPERATOR.dic}
              </dd>
              <dt className="font-semibold text-ink">Sídlo</dt>
              <dd className="text-ink-soft">{OPERATOR.address}</dd>
              <dt className="font-semibold text-ink">Zápis</dt>
              <dd className="text-ink-soft">{OPERATOR.registry}</dd>
              <dt className="font-semibold text-ink">Oprava údajů</dt>
              <dd className="text-ink-soft">
                Námitku proti zobrazení údajů v katalogu firem nebo žádost o opravu podáte přes{" "}
                <Link href="/namitka" className="font-medium text-brand-700 underline underline-offset-4">
                  formulář námitky
                </Link>
                .
              </dd>
            </dl>
            <p className="mt-6 text-sm text-muted">
              Na dotazy k vašim daňovým povinnostem neodpovídáme závazně – obraťte se na daňového poradce nebo na Finanční správu.
            </p>
          </section>

          <ToolCta />
        </div>
      </div>
    </>
  );
}
