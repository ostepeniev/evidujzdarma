import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { ToolFaq } from "@/components/tools/tool-faq";
import { VatCalculator } from "@/components/tools/vat-calculator";
import { SOURCES } from "@/content/facts";
import { JsonLd, faqLd, howToLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S2 B1 (17. 10. 2026): kalkulačka DPH – sazby 21 % a 12 % (§ 47 ZDPH, znění k 1. 1. 2026), výpočet podle § 37.
 * Poznámka k EET 2.0: datová zpráva DPH neřeší (MF a FS, seminář pro vývojáře) – eviduje se skutečně přijatá částka.
 */
export const metadata: Metadata = {
  title: "Kalkulačka DPH 2026: 21 % a 12 %, z ceny s DPH i bez",
  description:
    "Spočítejte DPH z ceny bez daně i z ceny s daní (§ 37 zákona o DPH), dopočet ze známé daně a DPH z tržby podle sazeb. Sazby 21 % a 12 % platné v roce 2026.",
  ...canonicalMeta("/kalkulacka-dph"),
};

const STEPS = [
  { name: "Ze základu daně", text: "DPH = základ × sazba. Například 200 000 Kč × 21 % = 42 000 Kč, cena s DPH 242 000 Kč." },
  { name: "Z ceny s DPH", text: "DPH = cena s DPH − cena s DPH / 1,21 (u snížené sazby / 1,12). Například 242 000 − 242 000 / 1,21 = 42 000 Kč." },
  { name: "Zaokrouhlení", text: "Výsledek zaokrouhlete na haléře. Částka, o kterou zaokrouhlíte celkovou cenu na celé koruny, do základu daně nevstupuje." },
];

const FAQ = [
  {
    q: "Jaké sazby DPH platí v roce 2026?",
    a: "Základní sazba 21 % a snížená sazba 12 % (§ 47 zákona o DPH). Dvě sazby platí od 1. 1. 2024 – tehdy se zrušila druhá snížená sazba 10 % a místo první snížené sazby 15 % se zavedla jediná snížená sazba 12 %. Do které sazby zboží nebo službu zařadit, určují přílohy č. 2 a 3 zákona; v nejasných případech se poraďte s účetní.",
  },
  {
    q: "Jak spočítám DPH z ceny včetně daně?",
    a: "Podle § 37 písm. b) zákona o DPH: daň = cena s daní − cena s daní / 1,21, u snížené sazby / 1,12. Od 1. 10. 2019 tento výpočet dává stejný výsledek jako výpočet ze základu daně – podle Finanční správy už mezi nimi nevznikají žádné rozdíly.",
  },
  {
    q: "Jak je to se zaokrouhlením na celé koruny při platbě v hotovosti?",
    a: "Částka vzniklá zaokrouhlením celkové ceny na celé koruny do základu daně nevstupuje (§ 36 odst. 5 a § 37 písm. b) zákona o DPH). Do EET 2.0 se eviduje skutečně přijatá částka: útrata 78,90 Kč zaplacená v hotovosti a zaokrouhlená na 79 Kč se zaeviduje jako 79 Kč, při platbě kartou jako 78,90 Kč.",
  },
  {
    q: "Posílá se DPH do EET 2.0?",
    a: "Ne. Datová zpráva EET 2.0 nese celkovou částku tržby; položky DPH z ní podle Ministerstva financí a Finanční správy vypadly a DPH se v evidenci tržeb neřeší. Rozpis podle sazeb potřebujete jen pro vlastní evidenci a přiznání k DPH.",
  },
];

const FAQ_SOURCES = [SOURCES.zdphSazby, SOURCES.fsSazbyDph2024, SOURCES.fsVypocetDph, SOURCES.seminarVyvojari];

export default function VatCalculatorPage() {
  return (
    <>
      <JsonLd data={[howToLd({ name: "Jak spočítat DPH", description: "Výpočet DPH ze základu i z ceny s daní podle § 37 zákona o DPH.", steps: STEPS }), faqLd(FAQ)]} />
      <PageHeader
        title="Kalkulačka DPH"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Kalkulačka DPH", path: "/kalkulacka-dph" },
        ]}
        lead="Základ, DPH a cena s daní v obou sazbách – 21 % a 12 %. Počítáme podle § 37 zákona o DPH na haléře, i z denní tržby rozdělené podle sazeb."
      />
      <div className="container-page py-10">
        <VatCalculator />
        <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="jak-dph">
          <h2 id="jak-dph" className="text-2xl font-bold">
            Jak se DPH počítá
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-[17px] text-ink-soft">
            {STEPS.map((s) => (
              <li key={s.name}>
                <strong className="text-ink">{s.name}.</strong> {s.text}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted">
            Sazby podle § 47 zákona č. 235/2004 Sb. ve znění k 1. 1. 2026, stav k 17. 10. 2026. Příklad 200 000 / 242 000 Kč uvádí Finanční správa.
          </p>
        </section>
        <ToolFaq items={FAQ} sources={FAQ_SOURCES} />
        <RelatedGuides slugs={["eet-2-0-vs-eet-1-0", "eet-gastronomie", "musim-vydavat-uctenku"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta />
      </div>
    </>
  );
}
