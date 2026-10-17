import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { FACTS_UPDATED } from "@/content/facts";
import { JsonLd } from "@/lib/jsonld";
import { SITE_URL, absoluteUrl } from "@/lib/site";
import { ExternalLink } from "@/components/external-link";
import { canonicalMeta } from "@/lib/metadata";
import { reviewedMoneyTools } from "@/lib/money-review";

export const metadata: Metadata = {
  title: "Nástroje k EET 2.0 zdarma",
  description:
    "Nástroje zdarma: kontrola IČO pro EET 2.0, kalkulačka EET OFF, faktura a doklad o prodeji, kalkulačka DPH, úrok z prodlení, ověření DIČ a IBAN, checklist.",
  ...canonicalMeta("/nastroje"),
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
    href: "/checklist-eet",
    title: "Checklist EET 2.0",
    text: "Osm kroků do 1. 1. 2027: DIS+, evidenční jednotky, certifikát, pokladna, EET OFF a zkouška v prosinci. Odškrtávejte, nebo si seznam vytiskněte.",
    tag: "Novinka",
    time: "2 minuty",
  },
  {
    href: "/doklad-o-prodeji",
    title: "Doklad o prodeji",
    text: "Zákazník chce doklad a pokladnu nemáte po ruce? Vyplníte prodávajícího a položky, doklad podle § 16 zákona o ochraně spotřebitele vytisknete nebo uložíte jako PDF.",
    time: "1 minuta",
  },
  {
    href: "/faktura-zdarma",
    title: "Faktura zdarma",
    text: "Faktura pro plátce i neplátce DPH bez registrace: odběratel z ARES, QR platba k převodu, rekapitulace DPH podle sazeb a zálohová faktura. Tisk nebo PDF.",
    tag: "Novinka",
    time: "3 minuty",
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
  // S2 B1: skupina „Kalkulačky a ověření“ (17. 10. 2026) – vykresluje se zvlášť pod hlavní mřížkou
  {
    href: "/kalkulacka-dph",
    title: "Kalkulačka DPH",
    text: "Základ, DPH a cena s daní v sazbách 21 % a 12 % – ze základu, z ceny s DPH i z denní tržby rozdělené podle sazeb.",
    time: "20 vteřin",
    group: "kalkulacky",
  },
  {
    href: "/kalkulacka-urok-z-prodleni",
    title: "Úrok z prodlení",
    text: "Zákonný úrok z prodlení podle nařízení vlády č. 351/2013 Sb.: repo sazba ČNB + 8 procentních bodů, s náklady 1 200 Kč mezi podnikateli.",
    time: "30 vteřin",
    group: "kalkulacky",
  },
  {
    href: "/nastroje/datum-splatnosti",
    title: "Datum splatnosti faktury",
    text: "Datum vystavení + počet dní: den splatnosti, den v týdnu a upozornění na víkend nebo státní svátek.",
    time: "10 vteřin",
    group: "kalkulacky",
  },
  {
    href: "/nastroje/overeni-ico",
    title: "Ověření IČO",
    text: "Sedí kontrolní číslice IČO? Ukážeme výpočet krok za krokem a platné IČO hned prověříte v kontrole EET 2.0.",
    time: "5 vteřin",
    group: "kalkulacky",
  },
  {
    href: "/nastroje/overeni-dic",
    title: "Ověření DIČ",
    text: "Odpovídá DIČ zákonnému tvaru – podle IČO, rodného čísla nebo identifikátoru Finanční správy? DIČ nikam neodesíláme.",
    time: "5 vteřin",
    group: "kalkulacky",
  },
  {
    href: "/nastroje/overeni-iban",
    title: "Ověření IBAN",
    text: "Kontrolní číslice IBAN z jakékoli země. U českého IBAN i číslo účtu, banka a BIC podle číselníku ČNB.",
    time: "5 vteřin",
    group: "kalkulacky",
  },
  {
    href: "/nastroje/ucet-na-iban",
    title: "Číslo účtu na IBAN",
    text: "Převod českého čísla účtu na IBAN a zpět, s kontrolou čísla účtu podle vyhlášky č. 169/2011 Sb.",
    time: "10 vteřin",
    group: "kalkulacky",
  },
  // S2/B2: peněžní kalkulačky – v rozcestníku až po kontrole účetní (lib/money-review.ts)
  ...reviewedMoneyTools(),
] as const;

type Tool = (typeof TOOLS)[number];
const MAIN_TOOLS = TOOLS.filter((t) => !("group" in t));
const CALC_TOOLS = TOOLS.filter((t) => "group" in t && t.group === "kalkulacky");

function ToolCard({ t }: { t: Tool }) {
  return (
    <Link href={t.href} className="card group flex h-full flex-col transition-colors hover:border-brand-500 hover:bg-brand-50/40">
      <div className="flex flex-wrap items-center gap-2">
        {"tag" in t && <span className="chip bg-sun-100 text-ink">{t.tag}</span>}
        <span className="chip bg-surface text-muted">
          <span className="sr-only">Časová náročnost:</span> {t.time}
        </span>
      </div>
      <h3 className="mt-3 text-xl font-bold text-ink group-hover:text-brand-700">{t.title}</h3>
      <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-soft">{t.text}</p>
      <span className="mt-4 text-[15px] font-semibold text-brand-700" aria-hidden="true">
        Otevřít nástroj →
      </span>
    </Link>
  );
}

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
        lead="Bezplatní pomocníci pro podnikatele: zjistíte, zda se vás evidence tržeb týká, připravíte se na start a vystavíte fakturu nebo doklad. Bez registrace a bez poplatků."
      />
      <div className="container-page py-10 sm:py-14">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MAIN_TOOLS.map((t) => (
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

        <section id="kalkulacky" className="mt-14 scroll-mt-24" aria-labelledby="kalkulacky-h">
          <h2 id="kalkulacky-h" className="text-2xl font-bold">
            Kalkulačky a ověření
          </h2>
          <p className="mt-2 max-w-3xl text-[17px] text-ink-soft">
            Pomocníci pro fakturaci a platby: DPH, úrok z prodlení, splatnost, IČO, DIČ a IBAN. Počítají jen ve vašem prohlížeči, nic neodesílají.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CALC_TOOLS.map((t) => (
              <li key={t.href}>
                <ToolCard t={t} />
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-14 max-w-3xl rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="jak-pocitame">
          <h2 id="jak-pocitame" className="text-xl font-bold">
            Odkud nástroje berou data
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Údaje o firmách načítáme z veřejného registru ARES, pravidla EET 2.0 z oficiálních zdrojů Finanční správy (
            <ExternalLink href="https://eet.gov.cz" className="underline underline-offset-2">
              eet.gov.cz
            </ExternalLink>
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
