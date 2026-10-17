import type { Metadata } from "next";
import { ExternalLink } from "@/components/external-link";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { DicValidator } from "@/components/tools/dic-validator";
import { ToolFaq } from "@/components/tools/tool-faq";
import { SOURCES } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S2 B1 (17. 10. 2026): kontrola tvaru českého DIČ (§ 130 daňového řádu). DIČ fyzické osoby obsahuje rodné číslo –
 * nic se neodesílá, žádné API; registraci k DPH ověří uživatel sám v Registru DPH Finanční správy.
 */
export const metadata: Metadata = {
  title: "Ověření DIČ zdarma: kontrola tvaru českého DIČ",
  description:
    "Zkontrolujte tvar českého DIČ: CZ a IČO u firem, CZ a rodné číslo u fyzických osob, CZ a identifikátor Finanční správy. DIČ nikam neodesíláme.",
  ...canonicalMeta("/nastroje/overeni-dic"),
};

const FAQ = [
  {
    q: "Znamená platný tvar DIČ, že je firma plátcem DPH?",
    a: "Ne. DIČ přidělí správce daně každému, kdo se registruje k některé dani, nejen k DPH (§ 130 daňového řádu). Zda je subjekt plátcem DPH a zda není nespolehlivým plátcem, ověříte v Registru DPH Finanční správy.",
  },
  {
    q: "Může mít fyzická osoba DIČ bez rodného čísla?",
    a: "Ano. Od 1. 1. 2021 může fyzická osoba požádat o vlastní identifikátor správce daně, který pak tvoří kmenovou část DIČ místo rodného čísla (§ 130 odst. 4 daňového řádu). Stejný druh identifikátoru dostane i ten, kdo rodné číslo nemá. Podle Finanční správy jde o devítimístné číslo, které začíná šestkou a končí kontrolní číslicí.",
  },
  {
    q: "Co je EIČ v EET 2.0?",
    a: "Evidenční identifikační číslo, kterým se poplatník označuje v datové zprávě o tržbě. Je to DIČ. Fyzická osoba, která DIČ nemá, použije kód CZ a rodné číslo, případně vlastní identifikátor, který jí správce daně zpřístupní v DIS+.",
  },
  {
    q: "Jak ověřím DIČ z jiné země EU?",
    a: "V systému VIES Evropské komise. Finanční správa doporučuje výsledek ověření i s přesným časem dotazu uložit, například jako snímek obrazovky.",
  },
  {
    q: "Posíláte DIČ na server?",
    a: "Ne. DIČ fyzické osoby obvykle obsahuje rodné číslo, proto kontrola běží jen ve vašem prohlížeči a nic se neukládá.",
  },
];

const FAQ_SOURCES = [SOURCES.danovyRad, SOURCES.fsZmenaDic, SOURCES.fsVcp, SOURCES.seminarVyvojari, SOURCES.registrDph, SOURCES.fsVies];

const ROWS = [
  ["Právnická osoba", "CZ + IČO (8 číslic)", "Kontrolní číslice IČO (modulo 11)"],
  [
    "Fyzická osoba",
    "CZ + rodné číslo (10 číslic, u narozených před 1. 1. 1954 9 číslic)",
    "Platné datum narození (u žen měsíc + 50, v dodatečné řadě + 20 / + 70); desetimístné číslo dělitelné 11",
  ],
  ["Vlastní identifikátor (VČP)", "CZ + 9 číslic začínajících 6", "Kontrolní číslici Finanční správa nezveřejňuje – ověříme jen tvar"],
] as const;

export default function DicValidatorPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Ověření DIČ"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Ověření DIČ", path: "/nastroje/overeni-dic" },
        ]}
        lead="Zadejte DIČ a zjistíte, zda odpovídá zákonnému tvaru – podle IČO, rodného čísla nebo identifikátoru Finanční správy. Kontrola běží jen ve vašem prohlížeči."
      />
      <div className="container-page py-10">
        <DicValidator />
        <section className="mx-auto mt-14 max-w-4xl" aria-labelledby="tvar-dic">
          <h2 id="tvar-dic" className="text-2xl font-bold">
            Jak vypadá české DIČ
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
            Daňové identifikační číslo tvoří kód „CZ“ a kmenová část. Tou je u právnické osoby IČO, u fyzické osoby rodné číslo, nebo vlastní identifikátor,
            který přidělí správce daně (§ 130 daňového řádu).
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-[15px]">
              <thead className="border-b border-line text-sm text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Kdo
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Tvar
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Co kontrolujeme
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([who, form, check]) => (
                  <tr key={who} className="border-b border-line align-top">
                    <th scope="row" className="py-3 pr-4 font-semibold text-ink">
                      {who}
                    </th>
                    <td className="py-3 pr-4 text-ink-soft">{form}</td>
                    <td className="py-3 text-ink-soft">{check}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">
            Rodné číslo podle § 13 zákona o evidenci obyvatel a{" "}
            <ExternalLink href={SOURCES.mvRodneCislo.url} className="underline underline-offset-2">
              Ministerstva vnitra
            </ExternalLink>
            ; vlastní identifikátor podle{" "}
            <ExternalLink href={SOURCES.fsVcp.url} className="underline underline-offset-2">
              informace Finanční správy č. 76/26
            </ExternalLink>
            . Stav k 17. 10. 2026.
          </p>
        </section>
        <ToolFaq items={FAQ} sources={FAQ_SOURCES} />
        <RelatedGuides slugs={["glosar-eet", "jak-aktivovat-dis-a-certifikat", "trzba-za-jineho"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta />
      </div>
    </>
  );
}
