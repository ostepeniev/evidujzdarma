import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { FACTS_UPDATED } from "@/content/facts";
import { JsonLd } from "@/lib/jsonld";
import { SITE_URL, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Nástroje k EET 2.0 zdarma",
  description:
    "Bezplatné nástroje k EET 2.0: kontrola IČO, kvíz Musím evidovat?, kalkulačka EET OFF, průvodce evidenčními jednotkami, QR platba a hromadná kontrola pro účetní.",
  alternates: { canonical: "/nastroje" },
};

const TOOLS = [
  {
    href: "/kontrola-ico",
    title: "Kontrola IČO",
    text: "Zadejte IČO a zjistěte, zda se vás EET 2.0 pravděpodobně týká, kolik máte provozoven v živnostenském rejstříku a zda připadá v úvahu EET OFF.",
    tag: "Nejpoužívanější",
    time: "10 vteřin",
  },
  {
    href: "/musim-evidovat",
    title: "Kvíz: Musím evidovat?",
    text: "Pár otázek o tom, jak přijímáte platby a v jakém jste daňovém režimu. Na konci dostanete srozumitelnou odpověď s odkazy na zdroje.",
    time: "2 minuty",
  },
  {
    href: "/kalkulacka-eet-off",
    title: "Kalkulačka EET OFF",
    text: "Paušalisté v 1. pásmu si spočítají, zda se jim vyplatí přirážka místo evidence tržeb – a do kdy se musí rozhodnout.",
    time: "1 minuta",
  },
  {
    href: "/evidencni-jednotky",
    title: "Průvodce evidenčními jednotkami",
    text: "Provozovna, stánek, automat, vozidlo nebo web? Průvodce vám řekne, kolik evidenčních jednotek oznámit v DIS+ a jakého typu.",
    time: "3 minuty",
  },
  {
    href: "/qr-platba",
    title: "Generátor QR platby",
    text: "QR kód pro platbu na účet ve formátu QR Platba (SPAYD). Funguje se všemi českými bankami a údaje neopouštějí váš prohlížeč.",
    time: "30 vteřin",
  },
  {
    href: "/stav-eet",
    title: "Je EET dole?",
    text: "Funguje rozhraní Finanční správy právě teď? Měříme dostupnost a odezvu každých 5 minut a ukazujeme historii výpadků.",
    time: "5 vteřin",
  },
  {
    href: "/mcp",
    title: "EET 2.0 pro AI asistenty",
    text: "Připojte Claude, ChatGPT nebo Cursor k našim nástrojům přes MCP: kontrola IČO, EET OFF, fakta se zdroji a stav EET přímo v chatu.",
    tag: "Novinka",
    time: "2 minuty",
  },
  {
    href: "/ucetni/hromadna-kontrola",
    title: "Hromadná kontrola IČO pro účetní",
    text: "Vložte seznam IČO nebo nahrajte CSV a během chvíle uvidíte, kterých klientů se EET 2.0 pravděpodobně týká. Výsledek stáhnete jako CSV.",
    tag: "Pro účetní",
    time: "1 minuta",
  },
] as const;

export default function ToolsPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Nástroje k EET 2.0 zdarma",
          url: absoluteUrl("/nastroje"),
          itemListElement: TOOLS.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: t.title,
            url: `${SITE_URL}${t.href}`,
          })),
        }}
      />
      <PageHeader
        title="Nástroje k EET 2.0 zdarma"
        crumbs={[{ name: "Nástroje", path: "/nastroje" }]}
        lead="Šest bezplatných pomocníků, se kterými zjistíte, zda se vás evidence tržeb týká, a připravíte se na start. Bez registrace a bez poplatků."
      />
      <div className="container-page py-10 sm:py-14">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="card group flex h-full flex-col transition-colors hover:border-brand-500 hover:bg-brand-50/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {"tag" in t && <span className="chip bg-sun-100 text-ink">{t.tag}</span>}
                  <span className="chip bg-surface text-muted">
                    <span className="sr-only">Časová náročnost:</span> {t.time}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-bold text-ink group-hover:text-brand-700">{t.title}</h2>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-soft">{t.text}</p>
                <span className="mt-4 text-[15px] font-semibold text-brand-700" aria-hidden="true">
                  Otevřít nástroj →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <section className="mx-auto mt-14 max-w-3xl rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="jak-pocitame">
          <h2 id="jak-pocitame" className="text-xl font-bold">
            Odkud nástroje berou data
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Údaje o firmách načítáme z veřejného registru ARES, pravidla EET 2.0 z oficiálních zdrojů Finanční správy (
            <a href="https://eet.gov.cz" className="underline underline-offset-2" rel="noopener">
              eet.gov.cz
            </a>
            ) a z textu zákona. Fakta jsme naposledy ověřili {new Date(FACTS_UPDATED).toLocaleDateString("cs-CZ")}. Výsledky
            nástrojů jsou orientační – nenahrazují posouzení daňového poradce ani stanovisko Finanční správy.
          </p>
          <p className="mt-3 text-[15px] text-ink-soft">
            Hledáte vysvětlení pojmů a postupů? Podívejte se do{" "}
            <Link href="/navody" className="font-medium text-brand-700 underline underline-offset-4">
              návodů k EET 2.0
            </Link>
            .
          </p>
        </section>

        <div className="mx-auto max-w-3xl">
          <ToolCta />
        </div>
      </div>
    </>
  );
}
