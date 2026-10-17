import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "@/components/external-link";
import { Faq, type FaqItem } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { SwitchCostCalculator } from "@/components/switch-cost-calculator";
import { ToolCta } from "@/components/tool-cta";
import { FACTS } from "@/content/facts";
import { POS_PRICES, PRICES_CHECKED_LABEL, SWITCH_SOURCES } from "@/content/pos-prices";
import { IMPORT_LIMITS, IMPORT_PRESETS } from "@/lib/pos/import-products";
import { JsonLd, faqLd, howToLd } from "@/lib/jsonld";
import { isClosed } from "@/lib/launch";
import { canonicalMeta } from "@/lib/metadata";
import { SITE } from "@/lib/site";

/**
 * S2-E (17. 10. 2026): „Přejděte z jiné pokladny“ – kolik stojí placená pokladna za rok, férové srovnání základních
 * tarifů (srovnávací reklama: § 2980 OZ – objektivně, ověřitelně, srovnatelné se srovnatelným, s datem a zdrojem)
 * a postup přechodu: export zboží → import (od 2. 11. 2026) → certifikát z DIS+ → zkouška.
 */
const TITLE = "Přechod z jiné pokladny: EET 2.0 zdarma";
const DESCRIPTION =
  "Kolik ročně platíte za pokladnu? Srovnání cen základních tarifů s evidencí tržeb podle ceníků, kalkulačka a postup přechodu: export zboží, import, certifikát.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...canonicalMeta("/prechod-z-jine-pokladny"),
};

const closed = isClosed("/pokladna");
const maxRows = IMPORT_LIMITS.maxRows.toLocaleString("cs-CZ").replace(/\s/g, " ");
const presetNames = IMPORT_PRESETS.map((p) => p.label).join(" a ");

const STEPS = [
  {
    name: "Stáhněte seznam zboží ze staré pokladny",
    text: `Většina pokladen umí export ceníku nebo produktů do CSV či Excelu. ${IMPORT_PRESETS.map((p) => `${p.label}: ${p.exportHint}`).join(" ")} Soubor z Excelu uložte jako „CSV (oddělený středníkem)“.`,
  },
  {
    name: "Nahrajte soubor do EvidujZdarma",
    text: closed
      ? `Od 2. 11. 2026 v nastavení pokladny (Rychlá tlačítka → Importovat ze souboru) soubor nahrajete, v náhledu zkontrolujete názvy, ceny a sazby DPH a položky přidáte jedním tlačítkem. Sloupce exportu z pokladen ${presetNames} poznáme sami.`
      : `V nastavení pokladny (Rychlá tlačítka → Importovat ze souboru) soubor nahrajete, v náhledu zkontrolujete názvy, ceny a sazby DPH a položky přidáte jedním tlačítkem. Sloupce exportu z pokladen ${presetNames} poznáme sami.`,
  },
  {
    name: "Připravte certifikát v DIS+",
    text: `Od 1. 11. 2026 se v DIS+ (MOJE daně) přihlásíte k evidenci, oznámíte evidenční jednotky a vygenerujete pokladní certifikát. ${FACTS.certificate.summary}`,
  },
  {
    name: "Vyzkoušejte si prodej",
    text: closed
      ? "Pokladna bude umět prodávat v ukázkovém režimu i v testovacím prostředí Playground Finanční správy – tržby se tam neevidují v ostrém provozu. Obrazovku pokladny si můžete projít už teď v ukázce bez registrace."
      : "Prodej si vyzkoušejte v ukázkovém režimu nebo v testovacím prostředí Playground Finanční správy – tržby se tam neevidují v ostrém provozu.",
  },
  {
    name: "Starou licenci ukončete, až vše funguje",
    text: "Ve smlouvě se podívejte na výpovědní lhůtu. Než licenci ukončíte, stáhněte si ze staré pokladny přehledy tržeb pro účetní – import přenáší jen zboží a ceny.",
  },
];

const FAQ: FaqItem[] = [
  {
    q: "Musím při přechodu znovu oznamovat evidenční jednotky?",
    a: "Ne. Evidenční jednotky oznamujete v DIS+ a jejich čísla přiděluje Finanční správa, ne pokladna – změnou pokladny se nemění.",
  },
  {
    q: "Můžu použít certifikát, který už mám?",
    a: `${FACTS.certificate.summary} Do EvidujZdarma nahrajete soubor certifikátu (.p12) a heslo k němu. Pokud soubor nemáte, například proto, že certifikát za vás spravuje dodavatel staré pokladny, postup získání certifikátu v DIS+ popisuje náš návod k DIS+ a certifikátu.`,
  },
  {
    q: "Přenesou se i tržby a účtenky ze staré pokladny?",
    a: "Ne. Import přenáší jen seznam zboží s cenami a sazbami DPH. Historii prodejů a doklady si před ukončením licence stáhněte ze staré pokladny – účetní je bude potřebovat.",
  },
  {
    q: "Jaké soubory import přijme?",
    a: `CSV nebo TSV (text oddělený středníkem, čárkou nebo tabulátorem) v kódování UTF-8 i Windows-1250, s desetinnou čárkou i tečkou. Najednou nejvýš ${maxRows} položek a 1 MB. Sloupce exportu z pokladen ${presetNames} poznáme sami, u jiných pokladen přiřadíte název, cenu s DPH a sazbu DPH ručně. Soubor .xlsx uložte v Excelu jako CSV.`,
  },
  {
    q: "Je EvidujZdarma opravdu zdarma? Co neumí?",
    a: `Tarif Zdarma je zdarma navždy (čl. 6.2 obchodních podmínek): evidence tržeb, práce bez signálu, až 5 uživatelů, až 3 evidenční jednotky, doklad e-mailem, denní přehled, export CSV a QR platba. ${closed ? "Pokladna ale nebude mít" : "Pokladna ale nemá"} sklad, rezervace, věrnostní program ani mapu stolů – pokud je potřebujete, placený systém pro vás může dávat smysl.`,
  },
];

const EXTRAS = [
  { title: "Sklad a receptury", text: "příjem zboží, inventury, odpisy surovin, marže" },
  { title: "Rezervace a mapa stolů", text: "rezervační systém, objednávky ke stolu, bony do kuchyně, mobilní číšník" },
  { title: "Platební terminál", text: "terminál propojený s pokladnou – částku není třeba přepisovat ručně" },
  { title: "Věrnostní programy", text: "body, slevy a karty stálých zákazníků" },
  { title: "Hardware a servis", text: "pokladna s tiskárnou na klíč, záruka, náhradní zařízení, nonstop podpora" },
  { title: "Napojení", text: "e-shop, rozvozové aplikace, docházka, API" },
];

export default function SwitchPosPage() {
  return (
    <>
      <JsonLd
        data={[
          faqLd(FAQ),
          howToLd({ name: "Jak přejít z jiné pokladny na EvidujZdarma", description: "Export zboží ze staré pokladny, import, certifikát z DIS+ a zkouška prodeje.", steps: STEPS }),
        ]}
      />
      <PageHeader
        title="Proč platit za evidenci tržeb, když může být zdarma?"
        crumbs={[{ name: "Přechod z jiné pokladny", path: "/prechod-z-jine-pokladny" }]}
        lead={
          <p>
            {closed
              ? "Evidence tržeb pro EET 2.0 nemusí nic stát: zdarma bude státní aplikace MOJE eet (od 1. 12. 2026) i pokladna EvidujZdarma, kterou spouštíme 2. 11. 2026."
              : "Evidence tržeb pro EET 2.0 nemusí nic stát: zdarma je pokladna EvidujZdarma i státní aplikace MOJE eet (od 1. 12. 2026)."}{" "}
            Placené systémy ale nabízejí víc než evidenci – sklad, rezervace, terminál nebo věrnostní programy. Spočítejte si, kolik dnes
            za pokladnu platíte, a rozhodněte se sami.
          </p>
        }
      >
        <p className="mt-4 text-sm text-muted">Ceny podle veřejných ceníků výrobců k {PRICES_CHECKED_LABEL} · bez hardwaru a poplatků za platby kartou</p>
      </PageHeader>

      <div className="container-page py-10 sm:py-14">
        <section aria-labelledby="kalkulacka">
          <h2 id="kalkulacka" className="mx-auto mb-6 max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl">
            Kolik vás pokladna stojí za rok
          </h2>
          <SwitchCostCalculator />
        </section>

        <section aria-labelledby="srovnani" className="mx-auto mt-16 max-w-5xl">
          <h2 id="srovnani" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Základní tarify s evidencí tržeb: srovnání cen
          </h2>
          <p role="note" className="mt-4 max-w-3xl rounded-2xl border border-line bg-surface p-5 text-[15px] leading-relaxed text-ink">
            <strong>Jak srovnáváme:</strong> cenu základního tarifu pokladny podle veřejného ceníku k {PRICES_CHECKED_LABEL} – u každého
            výrobce nejlevnější tarif, u kterého ceník nebo web zmiňuje EET; kde to neuvádí, píšeme to u řádku. Vyšší tarify uvádíme pod
            ním. Ceny se mohou změnit – platí aktuální ceník výrobce. Neuvádíme hardware,
            platební terminály ani poplatky za platby kartou. S žádným z výrobců nejsme propojeni; názvy patří jejich vlastníkům. Najdete-li
            nepřesnost, napište nám na <a href={`mailto:${SITE.email}`} className="underline underline-offset-2">{SITE.email}</a> a opravíme ji.
          </p>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <caption className="sr-only">Ceny základních tarifů pokladen s evidencí tržeb k {PRICES_CHECKED_LABEL}</caption>
              <thead>
                <tr className="bg-surface text-sm text-ink-soft">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Pokladna a tarif
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Cena podle ceníku
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Za 12 měsíců
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Co tarif obsahuje
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Zdroj (ověřeno {PRICES_CHECKED_LABEL})
                  </th>
                </tr>
              </thead>
              <tbody>
                {POS_PRICES.map((p) => (
                  <tr key={p.id} className={`border-t border-line align-top text-[15px] ${p.kind === "ours" ? "bg-brand-50/50" : ""}`}>
                    <th scope="row" className="px-4 py-3 font-semibold text-ink">
                      {p.system}
                      <span className="block text-sm font-normal text-muted">{p.plan}</span>
                    </th>
                    <td className="px-4 py-3 text-ink">{p.priceText}</td>
                    <td className="px-4 py-3 text-ink-soft">{p.yearText}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {p.includes}
                      {p.note && <span className="mt-1 block text-sm text-muted">{p.note}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {p.kind === "ours" ? (
                        <Link href="/cenik" className="underline underline-offset-2">
                          Ceník EvidujZdarma
                        </Link>
                      ) : (
                        p.sources.map((s, i) => (
                          <span key={s.url}>
                            {i > 0 && <br />}
                            <ExternalLink href={s.url} className="underline underline-offset-2">
                              {s.label}
                            </ExternalLink>
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">
            „Za 12 měsíců“ = dvanáctinásobek měsíční ceny, pokud ceník neuvádí roční cenu. Neplátce DPH platí cenu s DPH (u cen bez DPH
            + 21 %). Údaje o MOJE eet podle zveřejněných informací Finanční správy a odborného tisku, podrobněji viz{" "}
            <Link href="/srovnani/moje-eet" className="underline underline-offset-2">
              srovnání s MOJE eet
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="navic" className="mx-auto mt-16 max-w-5xl">
          <h2 id="navic" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Co placené systémy nabízejí navíc
          </h2>
          <p className="mt-2 max-w-3xl text-lg text-ink-soft">
            Za vyšší cenu dostanete víc než evidenci tržeb. Pokud tyto funkce využíváte, placená pokladna se vám může vyplatit. EvidujZdarma{" "}
            {closed ? "bude pokladna" : "je pokladna"} pro evidenci tržeb a prodej – bez skladu, rezervací a věrnostních programů. Platební
            terminál připravujeme jako placený doplněk.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXTRAS.map((x) => (
              <li key={x.title} className="card">
                <p className="font-semibold text-ink">{x.title}</p>
                <p className="mt-1 text-[15px] text-ink-soft">{x.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="postup" className="mx-auto mt-16 max-w-3xl">
          <h2 id="postup" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Jak přejít krok za krokem
          </h2>
          <ol className="mt-6 space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.name} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">{s.name}</h3>
                  <p className="mt-1 text-[15px] text-ink-soft">{s.text}</p>
                  {i === 2 && (
                    <p className="mt-1 text-[15px]">
                      <Link href="/navody/jak-aktivovat-dis-a-certifikat" className="font-medium text-brand-700 underline underline-offset-4">
                        Návod: jak aktivovat DIS+ a stáhnout certifikát
                      </Link>
                    </p>
                  )}
                  {i === 3 && (
                    <p className="mt-1 text-[15px]">
                      <Link href="/ukazka" className="font-medium text-brand-700 underline underline-offset-4">
                        Ukázka pokladny bez registrace
                      </Link>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq" className="mx-auto mt-16 max-w-3xl">
          <h2 id="faq" className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
            Časté otázky
          </h2>
          <Faq items={FAQ} />
          <p className="mt-3 text-base text-muted">
            Zdroje:{" "}
            {SWITCH_SOURCES.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <ExternalLink href={s.url}>{s.label}</ExternalLink>
              </span>
            ))}
          </p>
        </section>

        <RelatedGuides slugs={["jak-aktivovat-dis-a-certifikat", "pokladna-v-mobilu-zdarma", "evidencni-jednotka"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta
          title={closed ? "Pokladnu spouštíme 2. 11. 2026" : "Začněte zdarma"}
          text={
            closed
              ? "Předregistrovat se můžete už teď. Zboží ze staré pokladny pak naimportujete v nastavení pokladny – evidence tržeb u nás bude zdarma navždy."
              : "Zboží ze staré pokladny naimportujete v nastavení pokladny a prodej si vyzkoušíte v ukázkovém režimu. Evidence tržeb je u nás zdarma navždy."
          }
        />
      </div>
    </>
  );
}
