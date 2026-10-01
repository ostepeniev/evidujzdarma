import Link from "next/link";
import { OPERATOR, SITE } from "@/lib/site";
import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Nástroje",
    links: [
      { href: "/kontrola-ico", label: "EET kontrola podle IČO" },
      { href: "/musim-evidovat", label: "Kvíz: Musím evidovat?" },
      { href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF" },
      { href: "/evidencni-jednotky", label: "Průvodce evidenčními jednotkami" },
      { href: "/qr-platba", label: "Generátor QR platby" },
    ],
  },
  {
    title: "Návody",
    links: [
      { href: "/navody/eet-2-0-kompletni-pruvodce", label: "EET 2.0: kompletní průvodce" },
      { href: "/navody/koho-se-eet-tyka", label: "Koho se EET týká" },
      { href: "/navody/evidencni-jednotka", label: "Evidenční jednotka" },
      { href: "/navody/eet-bez-internetu", label: "EET bez internetu" },
      { href: "/navody", label: "Všechny návody" },
    ],
  },
  {
    title: "Služba",
    links: [
      { href: "/pokladna", label: "Pokladna (aplikace)" },
      { href: "/ucetni", label: "Pro účetní" },
      { href: "/cenik", label: "Ceník" },
      { href: "/srovnani/moje-eet", label: "Srovnání s MOJE eet" },
      { href: "/firmy", label: "Katalog firem" },
    ],
  },
  {
    title: "O nás",
    links: [
      { href: "/o-nas", label: "O nás a kontakt" },
      { href: "/podminky", label: "Obchodní podmínky" },
      { href: "/ochrana-osobnich-udaju", label: "Ochrana osobních údajů" },
      { href: "/namitka", label: "Námitka / oprava údajů" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-ink-soft">{SITE.description}</p>
          <p className="rounded-xl border border-line bg-white p-3 text-sm text-ink">
            <strong>Nezávislá služba.</strong> EvidujZdarma není provozována Finanční správou ani jiným státním
            orgánem. Oficiální státní aplikace a informace:{" "}
            <a href="https://eet.gov.cz" className="underline underline-offset-2" rel="noopener">
              eet.gov.cz
            </a>
            .
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink-soft hover:text-brand-700">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            Provozovatel: {OPERATOR.name}
            {OPERATOR.ico && <>, IČO {OPERATOR.ico}</>}
            {OPERATOR.address && <>, {OPERATOR.address}</>}
            {OPERATOR.registry && <>, {OPERATOR.registry}</>} ·{" "}
            <a href={`mailto:${SITE.email}`} className="underline underline-offset-2">
              {SITE.email}
            </a>
          </p>
          <p>Obsah webu není daňovým poradenstvím. Údaje o firmách pocházejí z veřejného registru ARES.</p>
        </div>
      </div>
    </footer>
  );
}
