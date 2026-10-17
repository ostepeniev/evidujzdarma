import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "@/components/external-link";
import { Faq, type FaqItem } from "@/components/faq";
import { InvoiceGenerator } from "@/components/invoice-generator";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { FACTS, SOURCES } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { isClosed } from "@/lib/launch";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S2 (17. 10. 2026): bezplatný generátor faktur bez registrace (po vzoru fakturujzdarma.cz). Náležitosti ověřeny
 * v aktuálních zněních na zakonyprolidi.cz: § 435 OZ (verze 18), § 6, 20a, 26, 28, 29, 30, 30a, 37, 37a, 47 a 108 ZDPH
 * (verze 69), § 11 zákona o účetnictví (verze 40). Faktury s účtem přijdou později – tady se nic neukládá.
 */
export const metadata: Metadata = {
  title: "Faktura zdarma: online generátor faktur bez registrace",
  description:
    "Vystavte fakturu zdarma a bez registrace: plátce i neplátce DPH, údaje z ARES, QR platba a rekapitulace DPH. Tisk nebo PDF, údaje se nikam neukládají.",
  ...canonicalMeta("/faktura-zdarma"),
};

const kontaktni = (
  <Link href="/navody/kontaktni-platba" className="font-medium text-brand-700 underline underline-offset-4">
    Kontaktní platba: co se eviduje a co ne
  </Link>
);

const EET_ANSWER = `${FACTS.evidenced.notEvidenced} Neeviduje se ani QR kód z faktury, který zákazník zaplatí později z domova. Když vám ale zákazník fakturu zaplatí při osobním kontaktu – hotově, kartou nebo QR kódem na místě –, jde od ${FACTS.law.effectiveFrom} o evidovanou tržbu. Faktura sama evidenci nevylučuje, rozhoduje způsob platby.`;

const FAQ: FaqItem[] = [
  {
    q: "Je generátor faktur opravdu zdarma?",
    a: "Ano. Faktur vystavíte, kolik potřebujete, bez registrace a bez poplatků. Nic neukládáme: faktura se skládá ve vašem prohlížeči a na náš server jde jen IČO, když kliknete na „Doplnit z ARES“ nebo otevřete odkaz s IČO odběratele.",
  },
  {
    q: "Musím evidovat platbu za fakturu v EET 2.0?",
    a: EET_ANSWER,
    rich: (
      <p>
        {EET_ANSWER} Podrobně v návodu {kontaktni}.
      </p>
    ),
  },
  {
    q: "Musí neplátce DPH na faktuře uvést, že není plátce?",
    a: "Zákon to výslovně nevyžaduje. V praxi se věta „Dodavatel není plátcem DPH.“ uvádí, aby odběratel věděl, proč na faktuře daň chybí – generátor ji doplní sám. DPH na faktuře neplátce neuvádějte: kdo daň na dokladu uvede, musí ji přiznat (§ 108 odst. 4 písm. g) zákona o DPH).",
  },
  {
    q: "Musí být faktura podepsaná nebo orazítkovaná?",
    a: "Občanský zákoník ani zákon o DPH podpis ani razítko na faktuře nevyžadují. Firma, která vede účetnictví, ale musí mít u účetního dokladu podpisový záznam osoby odpovědné za účetní případ (§ 11 odst. 1 písm. f) zákona o účetnictví) – nemusí být přímo na faktuře. Jak to řešit u vás, poradí účetní.",
  },
  {
    q: "Můžu fakturu poslat e-mailem jako PDF?",
    a: "Ano. V okně tisku zvolte „Uložit jako PDF“ a soubor pošlete. Jste-li plátce DPH, musí s daňovým dokladem v elektronické podobě souhlasit odběratel (§ 26 odst. 3 zákona o DPH).",
  },
  {
    q: "Do kdy musí plátce DPH fakturu vystavit?",
    a: "Daňový doklad se vystavuje do 15 dnů ode dne, kdy vznikla povinnost přiznat daň (§ 28 odst. 8 zákona o DPH) – obvykle ode dne uskutečnění plnění, u zálohy ode dne jejího přijetí (§ 20a). Povinnost vystavit daňový doklad má plátce zejména u plnění pro podnikatele a právnické osoby (§ 28 odst. 1).",
  },
  {
    q: "Jaké sazby DPH generátor používá a jak počítá daň?",
    a: "Základní sazbu 21 % a sníženou 12 % (§ 47 odst. 1 zákona o DPH, stav k 17. 10. 2026). Ceny položek zadáváte bez DPH, generátor sečte základ daně za každou sazbu a daň spočítá jako součin základu a sazby (§ 37 písm. a)), zaokrouhlenou na haléře. Způsob zaokrouhlení daně na dokladu zákon výslovně neupravuje. Osvobozená plnění, přenesenou daňovou povinnost ani plnění do zahraničí generátor neřeší – v těchto případech se poraďte s účetní.",
  },
  {
    q: "Kdy se stanu plátcem DPH?",
    a: "Podnikatel se sídlem v Česku se zpravidla stává plátcem od 1. ledna roku, který následuje po roce, v němž jeho obrat v tuzemsku překročil 2 000 000 Kč. Překročí-li obrat v průběhu roku 2 536 500 Kč, je plátcem už ode dne následujícího po překročení (§ 6 zákona o DPH, stav k 17. 10. 2026).",
  },
  {
    q: "Proč se adresa OSVČ z ARES nedoplní?",
    a: "U fyzických osob adresu z ARES nepřebíráme, načteme jen jméno, IČO a DIČ. Sídlo doplňte ručně. U firem se adresa doplní celá.",
  },
];

const FAQ_SOURCES = [SOURCES.oz435, SOURCES.zdph, SOURCES.zoUcetnictvi, SOURCES.kdoMusi];

const NEPLATCE = [
  "jméno a příjmení, nebo název (firmu),",
  "sídlo,",
  "IČO – identifikující údaj, byl-li vám přidělen,",
  "údaj o zápisu: v obchodním rejstříku včetně oddílu a vložky, v jiném veřejném rejstříku, nebo – pokud ve veřejném rejstříku nejste – v jiné evidenci; u OSVČ je to typicky živnostenský rejstřík.",
];

const PLATCE = [
  "označení dodavatele (jméno nebo firma, dodatek ke jménu, sídlo) a jeho DIČ,",
  "označení odběratele a jeho DIČ, pokud ho má,",
  "evidenční číslo daňového dokladu,",
  "rozsah a předmět plnění,",
  "den vystavení,",
  "den uskutečnění plnění, nebo den přijetí úplaty, liší-li se ode dne vystavení,",
  "jednotkovou cenu bez daně a slevu, není-li obsažena v jednotkové ceně,",
  "základ daně, sazbu daně a výši daně – daň vždy v korunách.",
];

const ctaText = isClosed("/pokladna")
  ? "Faktury placené převodem se do EET 2.0 neevidují, platby na místě ano. Pokladnu EvidujZdarma pro ně spouštíme 2. 11. 2026 – zdarma navždy. Předregistrovat se můžete už teď."
  : "Faktury placené převodem se do EET 2.0 neevidují, platby na místě ano. Pro ty máte pokladnu EvidujZdarma – zdarma navždy.";

export default function InvoicePage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Faktura zdarma"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Faktura zdarma", path: "/faktura-zdarma" },
        ]}
        lead="Vystavte fakturu bez registrace – jako plátce i neplátce DPH. Údaje o firmě doplníte z ARES, k platbě převodem se přidá QR platba a DPH se rozpočítá podle sazeb. Fakturu vytisknete, nebo uložíte jako PDF."
      />
      <div className="container-page py-10">
        <InvoiceGenerator />

        <section className="no-print mx-auto mt-14 max-w-3xl" aria-labelledby="nalezitosti">
          <h2 id="nalezitosti" className="text-2xl font-bold">
            Co musí faktura obsahovat
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-ink-soft">
            Náležitosti závisí na tom, zda jste plátce DPH. Generátor hlídá oba případy a dokud něco chybí, upozorní vás pod náhledem. Stav
            k 17. 10. 2026. Jak vypadá vyplněná faktura, ukazuje{" "}
            <Link href="/faktura-vzor" className="font-medium text-brand-700 underline underline-offset-4">
              vzor faktury pro plátce i neplátce DPH
            </Link>
            .
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="card">
              <h3 className="text-lg font-bold">Neplátce DPH</h3>
              <p className="mt-2 text-[15px] text-ink-soft">
                Každý podnikatel uvádí na obchodních listinách – tedy i na faktuře – podle § 435 odst. 1 občanského zákoníku:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-soft">
                {NEPLATCE.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="mt-3 text-[15px] text-ink-soft">
                Jméno a sídlo musí podnikatel uvádět i na svém webu. Odběratele, číslo faktury, data, položky a částku zákon neplátci
                výslovně nevypočítává; uvádějí se, aby faktura posloužila jako doklad a výzva k platbě. Odběratel, který vede účetnictví, ji
                použije jako účetní doklad (§ 11 zákona o účetnictví).
              </p>
            </div>
            <div className="card">
              <h3 className="text-lg font-bold">Plátce DPH: daňový doklad</h3>
              <p className="mt-2 text-[15px] text-ink-soft">Podle § 29 odst. 1 zákona o DPH musí daňový doklad obsahovat:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-soft">
                {PLATCE.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="mt-3 text-[15px] text-ink-soft">
                U osvobozeného plnění se uvádí odkaz na ustanovení zákona, při přenesení daňové povinnosti věta „daň odvede zákazník“
                (§ 29 odst. 2). Údaje podle § 435 občanského zákoníku – IČO a zápis v rejstříku – uvádí i plátce.
              </p>
            </div>
          </div>

          <h3 className="mt-10 text-xl font-bold">Zjednodušený daňový doklad do 10 000 Kč</h3>
          <p className="mt-2 text-lg leading-relaxed text-ink-soft">
            Je-li celková částka za plnění nejvýš 10 000 Kč, může plátce vystavit zjednodušený daňový doklad (§ 30 odst. 1 zákona o DPH).
            Ten nemusí obsahovat označení odběratele a jeho DIČ, jednotkovou cenu bez daně, základ daně ani výši daně; když výši daně
            neuvádí, musí uvést celkovou částku (§ 30a). Sazba daně mezi údaji, které lze vynechat, není. Nelze ho vystavit například při dodání zboží do jiného
            členského státu nebo když daň odvádí odběratel (§ 30 odst. 2). V generátoru vznikne, když jako plátce necháte odběratele
            prázdného a celková částka nepřesáhne 10 000 Kč.
          </p>

          <h3 className="mt-10 text-xl font-bold">Zálohová faktura (proforma)</h3>
          <p className="mt-2 text-lg leading-relaxed text-ink-soft">
            Zálohová faktura – v praxi se jí říká i proforma faktura – je výzva k zaplacení předem. Zákon o DPH ani jeden z pojmů
            nepoužívá. Daňovým dokladem taková faktura není. Plátci vzniká povinnost přiznat daň až přijetím platby, pokud je plnění v tu chvíli známo
            dostatečně určitě: zboží nebo služba, sazba daně a místo plnění (§ 20a odst. 2 a 3). Je-li odběratel podnikatel nebo právnická
            osoba, vystaví plátce k přijaté platbě do 15 dnů daňový doklad (§ 28 odst. 1 písm. d) a odst. 8).
          </p>
          <p className="mt-3 text-lg leading-relaxed text-ink-soft">
            Na konečné faktuře se zaplacená záloha odečte. Neplátce to udělá položkou se zápornou cenou. Plátce odečítá zálohu i se
            základem a daní (§ 37a zákona o DPH) – tady se poraďte s účetní, konečnou fakturu se zúčtováním zálohy generátor zatím
            nepočítá.
          </p>
        </section>

        <section className="no-print mx-auto mt-14 max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
          <Faq items={FAQ} />
          <p className="mt-3 text-base text-muted">
            Zdroje:{" "}
            {FAQ_SOURCES.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <ExternalLink href={s.url}>{s.label}</ExternalLink>
              </span>
            ))}
          </p>
          <p className="mt-3 text-sm text-muted">Generátor je pomůcka, nejde o daňové poradenství. Za správnost faktury odpovídá ten, kdo ji vystavuje.</p>
        </section>
        <div className="no-print">
          <RelatedGuides slugs={["kontaktni-platba", "eet-remeslnici", "musim-vydavat-uctenku"]} className="mx-auto mt-14 max-w-5xl" />
          <ToolCta text={ctaText} />
        </div>
      </div>
    </>
  );
}
